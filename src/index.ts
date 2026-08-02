import joplin from 'api';
import { MenuItemLocation } from '../api/types';
import { registerSettings, getSyncDirs, addSyncDir, SETTING_SYNC_DIRS, SETTING_SYNC_ENABLED } from './settings';
import { SyncManager } from './syncManager';
import { FileWatcher } from './fileWatcher';

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

      // Register Simple, Reliable Command & Dialog
      try {
        const dialogHandle = await joplin.views.dialogs.create('addSyncFolderDialog');
        await joplin.views.dialogs.setHtml(
          dialogHandle,
          `
          <div style="font-family: system-ui, -apple-system, sans-serif; padding: 10px;">
            <h3 style="margin-top: 0; color: #222;">JoplinBridge: Local Sync Folder</h3>
            <p style="color: #555; font-size: 13px;">Gib den absoluten Pfad zu deinem lokalen Markdown-Projektordner ein:</p>
            <p style="color: #777; font-size: 12px; margin-top: -6px;">Tipp (macOS Finder): Ordner rechtsklicken &rarr; <b>Option (&tau;) gedrückt halten</b> &rarr; <i>"Als Pfadnamen kopieren"</i> wählen.</p>

            <form name="folderForm" style="margin-top: 15px;">
              <label style="display: block; font-size: 12px; margin-bottom: 6px; font-weight: bold; color: #333;">Ordnerpfad:</label>
              <input type="text" id="folderPathInput" name="folderPath" style="width: 100%; padding: 10px; font-size: 13px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;" placeholder="/Users/username/Projects/my-app/docs" autofocus />
            </form>
          </div>
          `
        );

        await joplin.commands.register({
          name: 'joplinBridgeAddSyncFolder',
          label: 'JoplinBridge: Add Local Sync Folder...',
          iconName: 'fas fa-folder-plus',
          execute: async () => {
            const result = await joplin.views.dialogs.open(dialogHandle);
            if (result.id === 'ok' && result.formData && result.formData.folderForm && result.formData.folderForm.folderPath) {
              const pathToAdd = result.formData.folderForm.folderPath.trim();
              if (pathToAdd) {
                await addSyncDir(pathToAdd);
                const updatedDirs = await getSyncDirs();
                
                setTimeout(() => {
                  syncManager.bootstrapSync().catch(err => console.error('[JoplinBridge] Sync error:', err));
                  fileWatcher.start(updatedDirs);
                }, 100);

                console.error(`[JoplinBridge] Added new sync directory: ${pathToAdd}`);
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
