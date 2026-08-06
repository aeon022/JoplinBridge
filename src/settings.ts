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
        description: 'Absolute paths to local folders containing Markdown files (one per line or comma-separated), e.g. /path/to/project/docs'
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
        label: 'Root Notebook (optional)',
        description: 'If set, every synced folder is created as a sub-notebook under this notebook (created if it doesn\'t exist). Leave empty to create synced folders at the top level. Previously the first sync of a new folder nested it under whichever notebook happened to be open in the sidebar at that moment — this setting replaces that with a fixed, predictable location.'
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

/**
 * Returns an array of normalized, non-empty directory paths.
 */
export async function getSyncDirs(): Promise<string[]> {
  try {
    const raw = await joplin.settings.value(SETTING_SYNC_DIRS);
    if (!raw || typeof raw !== 'string') return [];

    return raw
      .split(/[\r\n,]+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  } catch (err) {
    console.error('[JoplinBridge] Error reading sync directory settings:', err);
    return [];
  }
}

/**
 * Adds a new directory path to the sync list if not already present.
 */
export async function addSyncDir(newDir: string): Promise<void> {
  const normalized = newDir.trim();
  if (!normalized) return;

  const currentDirs = await getSyncDirs();
  if (!currentDirs.includes(normalized)) {
    currentDirs.push(normalized);
    await joplin.settings.setValue(SETTING_SYNC_DIRS, currentDirs.join('\n'));
  }
}

export async function isSyncEnabled(): Promise<boolean> {
  try {
    return await joplin.settings.value(SETTING_SYNC_ENABLED);
  } catch {
    return true;
  }
}
