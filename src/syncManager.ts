import joplin from 'api';
import * as fs from 'fs-extra';
import * as path from 'path';
import { parseFrontmatter, stringifyFrontmatter, sanitizeFilename } from './utils';
import { getSyncDirEntries, isSyncEnabled, SyncDirEntry } from './settings';

export class SyncManager {
  private activeWrites = new Set<string>();
  private activeNoteIds = new Set<string>(); // Lock note IDs during local/remote writes to prevent race condition
  private trackedNotes = new Map<string, string>(); // joplin_id -> absolute filePath
  private folderPathToIdMap = new Map<string, string>(); // "parentId:title" -> joplin_folder_id
  private idToFolderMap = new Map<string, { id: string; title: string; parent_id: string }>();
  private folderToSyncDirMap = new Map<string, { syncDir: string; relativeSubDir: string }>(); // joplin_folder_id -> local info

  private lockPath(filePath: string): void {
    const normalized = path.resolve(filePath);
    this.activeWrites.add(normalized);
  }

  public isLockedAndUnlock(filePath: string): boolean {
    const normalized = path.resolve(filePath);
    if (this.activeWrites.has(normalized)) {
      this.activeWrites.delete(normalized);
      return true;
    }
    return false;
  }

  private lockNoteId(noteId: string): void {
    this.activeNoteIds.add(noteId);
  }

  private unlockNoteId(noteId: string): void {
    this.activeNoteIds.delete(noteId);
  }

  /**
   * Safely synchronizes ONLY local Markdown files in configured sync directories.
   * Preserves folder and subfolder hierarchy as sub-notebooks in Joplin.
   */
  public async bootstrapSync(): Promise<void> {
    const enabled = await isSyncEnabled();
    if (!enabled) return;

    const syncEntries = await getSyncDirEntries();
    if (syncEntries.length === 0) return;

    try {
      console.error(`[JoplinBridge] Safe bootstrap sync for ${syncEntries.length} directories...`);

      await this.refreshJoplinFoldersCache();

      for (const entry of syncEntries) {
        const safeSyncDir = path.resolve(entry.dir);
        if (!(await fs.pathExists(safeSyncDir))) continue;

        const localFiles = await this.listMarkdownFiles(safeSyncDir);
        for (const filePath of localFiles) {
          await this.syncSingleLocalFile(filePath, safeSyncDir, entry.rootNotebook);
        }
      }

      console.error(`[JoplinBridge] Bootstrap completed. Tracking ${this.trackedNotes.size} synced notes.`);
    } catch (err) {
      console.error('[JoplinBridge] Error during bootstrap sync:', err);
    }
  }

  /**
   * Synchronizes a single local Markdown file with Joplin using Last-Write-Wins and sub-notebook mapping.
   */
  private async syncSingleLocalFile(filePath: string, syncDir: string, rootNotebook: string): Promise<void> {
    try {
      if (!(await fs.pathExists(filePath))) return;

      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const { frontmatter, body } = parseFrontmatter(content);

      const title = this.extractTitleFromContent(body, path.basename(filePath, '.md'));
      const parentId = await this.getOrCreateJoplinFolderForFile(filePath, syncDir, rootNotebook);

      if (frontmatter.joplin_id) {
        this.trackedNotes.set(frontmatter.joplin_id, filePath);

        let existingNote: any = null;
        try {
          existingNote = await joplin.data.get(['notes', frontmatter.joplin_id], {
            fields: ['id', 'title', 'body', 'updated_time', 'user_updated_time', 'parent_id']
          });
        } catch {
          existingNote = null;
        }

        if (existingNote) {
          const joplinUpdatedMs = existingNote.updated_time || existingNote.user_updated_time || 0;
          if (stats.mtimeMs > joplinUpdatedMs) {
            this.lockNoteId(existingNote.id);
            try {
              await joplin.data.put(['notes', existingNote.id], null, {
                title,
                body,
                parent_id: parentId || existingNote.parent_id
              });
              console.error(`[JoplinBridge] Local file newer: updated Joplin note ${existingNote.id}`);
            } finally {
              setTimeout(() => this.unlockNoteId(existingNote.id), 300);
            }
          } else if (joplinUpdatedMs > stats.mtimeMs) {
            await this.writeToLocalFile(filePath, frontmatter.joplin_id, existingNote.body || '', existingNote.updated_time);
            console.error(`[JoplinBridge] Joplin note newer: updated local file ${filePath}`);
          }
        } else {
          const newNote = await joplin.data.post(['notes'], null, {
            title,
            body,
            parent_id: parentId
          });
          if (newNote && newNote.id) {
            this.lockNoteId(newNote.id);
            try {
              await this.writeToLocalFile(filePath, newNote.id, body, Date.now());
              this.trackedNotes.set(newNote.id, filePath);
              console.error(`[JoplinBridge] Recreated note in Joplin (${newNote.id}) in folder ${parentId}`);
            } finally {
              setTimeout(() => this.unlockNoteId(newNote.id), 300);
            }
          }
        }
      } else {
        const newNote = await joplin.data.post(['notes'], null, {
          title,
          body,
          parent_id: parentId
        });

        if (newNote && newNote.id) {
          this.lockNoteId(newNote.id);
          try {
            await this.writeToLocalFile(filePath, newNote.id, body, Date.now());
            this.trackedNotes.set(newNote.id, filePath);
            console.error(`[JoplinBridge] Created new note in Joplin (${newNote.id}) in folder ${parentId}`);
          } finally {
            setTimeout(() => this.unlockNoteId(newNote.id), 300);
          }
        }
      }
    } catch (err) {
      console.error(`[JoplinBridge] Error syncing file ${filePath}:`, err);
    }
  }

  /**
   * Handles local file change or creation (Vim -> Joplin).
   */
  public async handleLocalFileChange(filePath: string): Promise<void> {
    if (this.isLockedAndUnlock(filePath)) {
      return;
    }

    const enabled = await isSyncEnabled();
    if (!enabled) return;

    const syncEntries = await getSyncDirEntries();
    if (syncEntries.length === 0) return;

    const matchedEntry = this.findMatchingSyncDirEntry(filePath, syncEntries);
    if (!matchedEntry) return;

    await this.syncSingleLocalFile(filePath, path.resolve(matchedEntry.dir), matchedEntry.rootNotebook);
  }

  /**
   * Handles Joplin note change or deletion event (Joplin -> Vim).
   * Automatically deletes local .md file when corresponding note is deleted in Joplin.
   */
  public async handleJoplinNoteChange(noteId: string): Promise<void> {
    if (this.activeNoteIds.has(noteId)) {
      return;
    }

    const enabled = await isSyncEnabled();
    if (!enabled) return;

    const mappedFilePath = this.trackedNotes.get(noteId);

    try {
      let note: any = null;
      try {
        note = await joplin.data.get(['notes', noteId], {
          fields: ['id', 'title', 'body', 'updated_time', 'parent_id']
        });
      } catch {
        note = null; // Note was deleted in Joplin
      }

      // Note was deleted in Joplin -> remove local file on disk
      if (!note) {
        if (mappedFilePath && (await fs.pathExists(mappedFilePath))) {
          this.lockPath(mappedFilePath);
          await fs.remove(mappedFilePath);
          this.trackedNotes.delete(noteId);
          console.error(`[JoplinBridge] Removed local file ${mappedFilePath} because Joplin note ${noteId} was deleted.`);
        }
        return;
      }

      const noteTitle = note.title && note.title.trim() ? note.title.trim() : 'Untitled';
      const sanitizedTitle = sanitizeFilename(noteTitle);
      const expectedFilename = `${sanitizedTitle}.md`;

      if (mappedFilePath) {
        const currentDir = path.dirname(mappedFilePath);
        const currentFilename = path.basename(mappedFilePath);
        const newFilePath = path.resolve(currentDir, expectedFilename);

        if (currentFilename !== expectedFilename && (await fs.pathExists(mappedFilePath))) {
          this.lockPath(newFilePath);
          await fs.rename(mappedFilePath, newFilePath);
          this.trackedNotes.set(noteId, newFilePath);
          await this.writeToLocalFile(newFilePath, note.id, note.body || '', note.updated_time);
          console.error(`[JoplinBridge] Renamed local file to match title change: ${newFilePath}`);
          return;
        }

        await this.writeToLocalFile(mappedFilePath, note.id, note.body || '', note.updated_time);
        console.error(`[JoplinBridge] Updated local file ${mappedFilePath} from Joplin note ${noteId}`);
      } else {
        if (!note.parent_id) return;

        const folderMapping = this.getSyncInfoForFolderId(note.parent_id);
        if (folderMapping) {
          const targetFilePath = path.resolve(folderMapping.syncDir, folderMapping.relativeSubDir, expectedFilename);

          await this.writeToLocalFile(targetFilePath, note.id, note.body || '', note.updated_time);
          this.trackedNotes.set(note.id, targetFilePath);
          console.error(`[JoplinBridge] Created new local file ${targetFilePath} for note ${noteId}`);
        }
      }
    } catch (err) {
      console.error(`[JoplinBridge] Error handling Joplin note change (${noteId}):`, err);
    }
  }

  /**
   * Resolves syncDir and subfolder info for a Joplin folder ID by traversing folder hierarchy.
   */
  private getSyncInfoForFolderId(folderId: string): { syncDir: string; relativeSubDir: string } | null {
    if (this.folderToSyncDirMap.has(folderId)) {
      return this.folderToSyncDirMap.get(folderId)!;
    }

    let currentId = folderId;
    const subParts: string[] = [];

    while (currentId) {
      if (this.folderToSyncDirMap.has(currentId)) {
        const baseMapping = this.folderToSyncDirMap.get(currentId)!;
        const fullSubDir = path.join(baseMapping.relativeSubDir, ...subParts);
        return { syncDir: baseMapping.syncDir, relativeSubDir: fullSubDir };
      }

      const folder = this.idToFolderMap.get(currentId);
      if (!folder) break;

      subParts.unshift(sanitizeFilename(folder.title));
      currentId = folder.parent_id;
    }

    return null;
  }

  /**
   * Resolves or creates matching Joplin notebook hierarchy for a local file path.
   */
  private async getOrCreateJoplinFolderForFile(filePath: string, syncDir: string, rootNotebookName: string): Promise<string> {
    // Used to seed parentId from joplin.workspace.selectedFolder() — whatever
    // notebook happened to be open in the sidebar at the moment a sync
    // directory was FIRST synced silently became the permanent parent for
    // its root notebook (cached in folderPathToIdMap/folderToSyncDirMap from
    // then on). That's how a folder like "documents" could end up nested
    // under an unrelated, arbitrary notebook instead of somewhere deliberate:
    // nothing pinned it, it just inherited whatever the UI happened to be
    // showing. Replaced with an explicit, per-directory root notebook
    // (falling back to a global default) — deterministic regardless of
    // sidebar state, so different sync dirs (e.g. missionctl vs. privat)
    // can each land under their own notebook.
    // Supports a nested path like "MISSIONCTL/Marketing" — each segment is
    // resolved (or created) one level at a time so it lands on the exact
    // existing notebook chain instead of only ever matching a top-level
    // notebook with that name.
    let parentId = '';
    if (rootNotebookName) {
      const rootParts = rootNotebookName.split('/').map(p => p.trim()).filter(Boolean);
      for (const part of rootParts) {
        parentId = await this.ensureJoplinFolder(part, parentId);
      }
    }

    const rootFolderName = path.basename(path.resolve(syncDir));
    parentId = await this.ensureJoplinFolder(rootFolderName, parentId);
    this.folderToSyncDirMap.set(parentId, { syncDir, relativeSubDir: '' });

    const relativePath = path.relative(path.resolve(syncDir), path.dirname(path.resolve(filePath)));
    if (relativePath && relativePath !== '.' && relativePath !== '') {
      const parts = relativePath.split(path.sep).filter(Boolean);
      let cumulativePath = '';
      for (const part of parts) {
        cumulativePath = cumulativePath ? path.join(cumulativePath, part) : part;
        parentId = await this.ensureJoplinFolder(part, parentId);
        this.folderToSyncDirMap.set(parentId, { syncDir, relativeSubDir: cumulativePath });
      }
    }

    return parentId;
  }

  /**
   * Gets or creates a single Joplin folder by title and parent_id.
   */
  private async ensureJoplinFolder(title: string, parentId: string): Promise<string> {
    const key = `${parentId}:${title.toLowerCase()}`;
    if (this.folderPathToIdMap.has(key)) {
      return this.folderPathToIdMap.get(key)!;
    }

    for (const folder of this.idToFolderMap.values()) {
      if (folder.title.toLowerCase() === title.toLowerCase() && folder.parent_id === parentId) {
        this.folderPathToIdMap.set(key, folder.id);
        return folder.id;
      }
    }

    const newFolder = await joplin.data.post(['folders'], null, {
      title,
      parent_id: parentId || ''
    });

    if (newFolder && newFolder.id) {
      this.idToFolderMap.set(newFolder.id, { id: newFolder.id, title, parent_id: parentId });
      this.folderPathToIdMap.set(key, newFolder.id);
      return newFolder.id;
    }

    return parentId;
  }

  /**
   * Refreshes local cache of all Joplin notebook folders.
   */
  private async refreshJoplinFoldersCache(): Promise<void> {
    try {
      this.idToFolderMap.clear();
      this.folderPathToIdMap.clear();

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
            this.idToFolderMap.set(item.id, { id: item.id, title: item.title, parent_id: item.parent_id || '' });
            const key = `${item.parent_id || ''}:${item.title.toLowerCase()}`;
            this.folderPathToIdMap.set(key, item.id);
          }
        }
        hasMore = response ? !!response.has_more : false;
      }
    } catch (err) {
      console.error('[JoplinBridge] Error refreshing Joplin folders cache:', err);
    }
  }

  /**
   * Writes content and frontmatter to a specific local file path.
   * Protects local body from being overwritten with empty string if local file has content.
   */
  private async writeToLocalFile(filePath: string, joplinId: string, body: string, updatedTimeMs?: number): Promise<void> {
    const existingContent = await fs.readFile(filePath, 'utf8').catch(() => '');
    const { frontmatter, body: existingBody } = parseFrontmatter(existingContent);

    let finalBody = body;
    if ((!body || body.trim() === '') && (existingBody && existingBody.trim() !== '')) {
      finalBody = existingBody;
    }

    const updatedFrontmatter = {
      ...frontmatter,
      joplin_id: joplinId,
      updated_at: new Date(updatedTimeMs || Date.now()).toISOString()
    };

    const fullContent = stringifyFrontmatter(updatedFrontmatter, finalBody);

    this.lockPath(filePath);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, fullContent, 'utf8');
  }

  /**
   * Recursively list all .md files in directory.
   */
  private async listMarkdownFiles(dirPath: string): Promise<string[]> {
    const results: string[] = [];
    if (!(await fs.pathExists(dirPath))) return results;

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.resolve(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) {
          const subFiles = await this.listMarkdownFiles(fullPath);
          results.push(...subFiles);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private findMatchingSyncDirEntry(filePath: string, syncEntries: SyncDirEntry[]): SyncDirEntry | null {
    const normalizedFile = path.resolve(filePath);
    for (const entry of syncEntries) {
      const normalizedDir = path.resolve(entry.dir);
      if (normalizedFile.startsWith(normalizedDir)) {
        return { dir: normalizedDir, rootNotebook: entry.rootNotebook };
      }
    }
    return null;
  }

  private extractTitleFromContent(body: string, fallback: string): string {
    const match = body.match(/^#\s+(.+)$/m);
    if (match && match[1]) {
      return match[1].trim();
    }
    return fallback;
  }
}
