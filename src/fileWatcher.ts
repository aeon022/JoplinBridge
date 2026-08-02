import * as chokidar from 'chokidar';
import * as path from 'path';

export interface FileWatcherOptions {
  onFileAddedOrChanged: (filePath: string) => Promise<void>;
  onFileDeleted: (filePath: string) => Promise<void>;
}

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;

  constructor(private options: FileWatcherOptions) {}

  public start(directoryPaths: string[]): void {
    this.stop();

    const validDirs = (directoryPaths || [])
      .map(d => path.resolve(d))
      .filter(Boolean);

    if (validDirs.length === 0) {
      console.error('[JoplinBridge] FileWatcher: No valid directory paths provided.');
      return;
    }

    const watchPatterns = validDirs.map(dir => path.join(dir, '**/*.md'));

    this.watcher = chokidar.watch(watchPatterns, {
      ignored: /(^|[\/\\])\../, // ignore hidden files
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('add', async (filePath: string) => {
      const fullPath = path.resolve(filePath);
      await this.options.onFileAddedOrChanged(fullPath);
    });

    this.watcher.on('change', async (filePath: string) => {
      const fullPath = path.resolve(filePath);
      await this.options.onFileAddedOrChanged(fullPath);
    });

    this.watcher.on('unlink', async (filePath: string) => {
      const fullPath = path.resolve(filePath);
      await this.options.onFileDeleted(fullPath);
    });

    console.error(`[JoplinBridge] FileWatcher started monitoring ${validDirs.length} directories:`, validDirs);
  }

  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.error('[JoplinBridge] FileWatcher stopped.');
    }
  }
}
