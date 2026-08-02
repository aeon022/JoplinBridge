import joplin from 'api';

export const SETTING_SYNC_DIRS = 'syncDirectories';
export const SETTING_SYNC_ENABLED = 'syncEnabled';
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
      }
    });
  } catch (err) {
    console.error('[JoplinBridge] Error registering settings:', err);
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
