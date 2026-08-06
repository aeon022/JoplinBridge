import joplin from 'api';

export const SETTING_SYNC_DIRS = 'syncDirectories';
export const SETTING_SYNC_ENABLED = 'syncEnabled';
export const SETTING_ROOT_NOTEBOOK = 'rootNotebookName';
export const SETTING_SECTION_NAME = 'joplinBridgeSettings';

export async function registerSettings(): Promise<void> {
  try {
    await joplin.settings.registerSection(SETTING_SECTION_NAME, {
      label: 'JoplinBridge',
      iconName: 'fas fa-sync'
    });

    await joplin.settings.registerSettings({
      [SETTING_SYNC_DIRS]: {
        value: '',
        type: 2, // String
        public: true,
        section: SETTING_SECTION_NAME,
        label: 'Local Sync Directories',
        description: 'One entry per line (or comma-separated): an absolute path, optionally followed by |NotebookName to root that folder under a specific notebook (use Parent/Child for a nested notebook, e.g. |MISSIONCTL/Marketing). E.g. /path/to/missionctl/postctl/documents|MISSIONCTL/Marketing or /path/to/privat/docs|Uni. Entries without |NotebookName fall back to the Root Notebook default below.'
      },
      [SETTING_SYNC_ENABLED]: {
        value: true,
        type: 3, // Bool
        public: true,
        section: SETTING_SECTION_NAME,
        label: 'Enable Sync',
        description: 'Toggle bidirectional synchronization.'
      },
      [SETTING_ROOT_NOTEBOOK]: {
        value: '',
        type: 2, // String
        public: true,
        section: SETTING_SECTION_NAME,
        label: 'Root Notebook (default)',
        description: 'Fallback root notebook for any sync directory that doesn\'t specify its own |NotebookName. Leave empty to create those at the top level. Previously the first sync of a new folder nested it under whichever notebook happened to be open in the sidebar at that moment — this setting (and the per-directory override above) replaces that with a fixed, predictable location.'
      }
    });
  } catch (err) {
    console.error('[JoplinBridge] Error registering settings:', err);
  }
}

/**
 * Returns the configured root notebook name, or '' if unset (top level).
 */
export async function getRootNotebookName(): Promise<string> {
  try {
    const raw = await joplin.settings.value(SETTING_ROOT_NOTEBOOK);
    return typeof raw === 'string' ? raw.trim() : '';
  } catch (err) {
    console.error('[JoplinBridge] Error reading root notebook setting:', err);
    return '';
  }
}

export interface SyncDirEntry {
  dir: string;
  /** Resolved root notebook for this dir — its own |NotebookName override,
   *  or the global SETTING_ROOT_NOTEBOOK default if it didn't specify one. */
  rootNotebook: string;
}

/**
 * Returns sync directories with their resolved root notebook. Each line in
 * SETTING_SYNC_DIRS is `path` or `path|NotebookName`; entries without a
 * per-line override fall back to the global default root notebook.
 */
export async function getSyncDirEntries(): Promise<SyncDirEntry[]> {
  try {
    const raw = await joplin.settings.value(SETTING_SYNC_DIRS);
    if (!raw || typeof raw !== 'string') return [];

    const defaultRoot = await getRootNotebookName();

    return raw
      .split(/[\r\n,]+/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const sepIndex = line.indexOf('|');
        if (sepIndex === -1) {
          return { dir: line, rootNotebook: defaultRoot };
        }
        const dir = line.slice(0, sepIndex).trim();
        const override = line.slice(sepIndex + 1).trim();
        return { dir, rootNotebook: override || defaultRoot };
      })
      .filter(entry => entry.dir.length > 0);
  } catch (err) {
    console.error('[JoplinBridge] Error reading sync directory settings:', err);
    return [];
  }
}

/**
 * Returns just the directory paths, e.g. for the file watcher, which
 * doesn't care which notebook a path is destined for.
 */
export async function getSyncDirs(): Promise<string[]> {
  const entries = await getSyncDirEntries();
  return entries.map(e => e.dir);
}

/**
 * Adds a new directory path to the sync list if not already present.
 * rootNotebook, if given, is stored as a per-directory |NotebookName
 * override; otherwise the directory falls back to the global default.
 */
export async function addSyncDir(newDir: string, rootNotebook?: string): Promise<void> {
  const normalized = newDir.trim();
  if (!normalized) return;

  const currentDirs = await getSyncDirs();
  if (currentDirs.includes(normalized)) return;

  const trimmedNotebook = (rootNotebook || '').trim();
  const newLine = trimmedNotebook ? `${normalized}|${trimmedNotebook}` : normalized;

  const raw = await joplin.settings.value(SETTING_SYNC_DIRS);
  const existingRaw = typeof raw === 'string' && raw.trim() ? raw.trim() : '';
  const updatedRaw = existingRaw ? `${existingRaw}\n${newLine}` : newLine;
  await joplin.settings.setValue(SETTING_SYNC_DIRS, updatedRaw);
}

export async function isSyncEnabled(): Promise<boolean> {
  try {
    return await joplin.settings.value(SETTING_SYNC_ENABLED);
  } catch {
    return true;
  }
}
