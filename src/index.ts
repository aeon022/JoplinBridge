import joplin from 'api';
import { MenuItemLocation } from '../api/types';
import { registerSettings, getSyncDirs, addSyncDir, SETTING_SYNC_DIRS, SETTING_SYNC_ENABLED } from './settings';
import { SyncManager } from './syncManager';
import { FileWatcher } from './fileWatcher';

/**
 * Fetches every notebook and returns their full nested paths
 * (e.g. "MISSIONCTL/Marketing"), sorted alphabetically — used to populate
 * the Notebook field's autocomplete so users with many (nested) notebooks
 * can pick an existing one instead of retyping its exact name/casing.
 */
async function fetchAllNotebookPaths(): Promise<string[]> {
  const idToFolder = new Map<string, { title: string; parent_id: string }>();

  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const response = await joplin.data.get(['folders'], {
      fields: ['id', 'title', 'parent_id'],
      page: page++,
      limit: 50
    });
    if (response && response.items) {
      for (const item of response.items) {
        idToFolder.set(item.id, { title: item.title, parent_id: item.parent_id || '' });
      }
    }
    hasMore = response ? !!response.has_more : false;
  }

  const pathFor = (id: string): string => {
    const parts: string[] = [];
    let currentId = id;
    let guard = 0; // defends against a corrupt parent_id cycle
    while (currentId && guard++ < 50) {
      const folder = idToFolder.get(currentId);
      if (!folder) break;
      parts.unshift(folder.title);
      currentId = folder.parent_id;
    }
    return parts.join('/');
  };

  return Array.from(idToFolder.keys())
    .map(pathFor)
    .sort((a, b) => a.localeCompare(b));
}

joplin.plugins.register({
  onStart: async () => {
    console.error('[JoplinBridge] Plugin initializing...');

    try {
      await registerSettings();

      const syncManager = new SyncManager();
      const fileWatcher = new FileWatcher({
        onFileAddedOrChanged: async (filePath: string) => {
          setTimeout(() => {
            syncManager.handleLocalFileChange(filePath).catch(err => console.error('[JoplinBridge] Watcher error:', err));
          }, 50);
        },
        onFileDeleted: async (filePath: string) => {
          console.error(`[JoplinBridge] Local deletion ignored (no-auto-delete policy): ${filePath}`);
        }
      });

      // Register Simple, Reliable Command & Dialog with Polar Support Link
      try {
        const dialogHandle = await joplin.views.dialogs.create('addSyncFolderDialog');
        // Default fit-to-content shrinks the dialog to its natural width,
        // which cut off the input placeholders (especially the Notebook
        // field's longer hint text). 90vw/80vh instead of shrink-wrapped.
        await joplin.views.dialogs.setFitToContent(dialogHandle, false);

        const buildDialogHtml = (notebookPaths: string[]): string => {
          const datalistOptions = notebookPaths
            .map(p => `<option value="${p.replace(/"/g, '&quot;')}"></option>`)
            .join('');

          return `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 10px;">
            <h3 style="margin-top: 0; color: #222;">JoplinBridge: Local Sync Folder</h3>
            <p style="color: #555; font-size: 13px;">Gib den absoluten Pfad zu deinem lokalen Markdown-Projektordner ein:</p>
            <p style="color: #777; font-size: 12px; margin-top: -6px;">Tipp (macOS Finder): Ordner rechtsklicken &rarr; <b>Option (&tau;) gedrückt halten</b> &rarr; <i>"Als Pfadnamen kopieren"</i> wählen.</p>

            <form name="folderForm" style="margin-top: 15px;">
              <label style="display: block; font-size: 12px; margin-bottom: 6px; font-weight: bold; color: #333;">Ordnerpfad:</label>
              <input type="text" id="folderPathInput" name="folderPath" style="width: 100%; padding: 10px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" placeholder="/Users/username/Projects/my-app/docs" autofocus />

              <label style="display: block; font-size: 12px; margin-bottom: 6px; margin-top: 12px; font-weight: bold; color: #333;">Notebook (optional):</label>
              <input type="text" id="notebookInput" name="notebook" list="notebookOptions" style="width: 100%; padding: 10px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" placeholder="Tippen zum Suchen — z.B. MISSIONCTL/Marketing — leer = Standard-Notebook aus den Einstellungen" />
              <datalist id="notebookOptions">${datalistOptions}</datalist>
              <p style="font-size: 11px; color: #999; margin-top: 4px; margin-bottom: 0;">Zeigt vorhandene Notizbücher (inkl. verschachtelter Pfade) beim Tippen an — oder gib einen neuen Namen/Pfad ein, um ein neues Notizbuch anzulegen.</p>
            </form>

            <p style="font-size: 11px; color: #888; margin-top: 20px; margin-bottom: 0; text-align: center;">
              💜 Gefällt dir JoplinBridge? <a href="https://buy.polar.sh/polar_cl_BN6xwyJH2Drn6WuzvV49E2KCGauvtoTHixD3w1hCpSH" target="_blank" style="color: #0066ff; text-decoration: none; font-weight: bold;">Entwicklung auf Polar unterstützen</a>
            </p>
          </div>
          `;
        };

        await joplin.views.dialogs.setHtml(dialogHandle, buildDialogHtml([]));

        await joplin.commands.register({
          name: 'joplinBridgeAddSyncFolder',
          label: 'JoplinBridge: Add Local Sync Folder...',
          iconName: 'fas fa-folder-plus',
          execute: async () => {
            // Refreshed on every invocation so newly created notebooks show
            // up without needing to restart Joplin.
            try {
              const notebookPaths = await fetchAllNotebookPaths();
              await joplin.views.dialogs.setHtml(dialogHandle, buildDialogHtml(notebookPaths));
            } catch (err) {
              console.error('[JoplinBridge] Error refreshing notebook list for dialog:', err);
            }

            const result = await joplin.views.dialogs.open(dialogHandle);
            if (result.id === 'ok' && result.formData && result.formData.folderForm && result.formData.folderForm.folderPath) {
              const pathToAdd = result.formData.folderForm.folderPath.trim();
              const notebookToAdd = (result.formData.folderForm.notebook || '').trim();
              if (pathToAdd) {
                await addSyncDir(pathToAdd, notebookToAdd);
                const updatedDirs = await getSyncDirs();

                setTimeout(() => {
                  syncManager.bootstrapSync().catch(err => console.error('[JoplinBridge] Sync error:', err));
                  fileWatcher.start(updatedDirs);
                }, 100);

                console.error(`[JoplinBridge] Added new sync directory: ${pathToAdd}${notebookToAdd ? ` (notebook: ${notebookToAdd})` : ''}`);
              }
            }
          }
        });

        await joplin.views.menuItems.create('addSyncFolderMenuItem', 'joplinBridgeAddSyncFolder', MenuItemLocation.Tools);
      } catch (cmdErr) {
        console.error('[JoplinBridge] Non-fatal error setting up dialog/command:', cmdErr);
      }

      // Joplin Note Change Listener
      await joplin.workspace.onNoteChange(async (event: { id: string }) => {
        if (event && event.id) {
          syncManager.handleJoplinNoteChange(event.id).catch(err => console.error('[JoplinBridge] Note change error:', err));
        }
      });

      // Settings Change Listener
      await joplin.settings.onChange(async (event: { keys: string[] }) => {
        if (event.keys.includes(SETTING_SYNC_DIRS) || event.keys.includes(SETTING_SYNC_ENABLED)) {
          const newDirs = await getSyncDirs();
          if (newDirs.length > 0) {
            setTimeout(() => {
              syncManager.bootstrapSync().catch(err => console.error('[JoplinBridge] Sync error:', err));
              fileWatcher.start(newDirs);
            }, 100);
          } else {
            fileWatcher.stop();
          }
        }
      });

      console.error('[JoplinBridge] Plugin registered successfully.');
    } catch (fatalErr) {
      console.error('[JoplinBridge] Fatal error during plugin start:', fatalErr);
    }
  }
});
