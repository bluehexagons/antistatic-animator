/**
 * Electron storage backend — reads/writes the user-selected game directory
 * via the preload-exposed Node fs API.
 */

import type { StorageBackend } from './types';

const CHAR_SUBDIR = 'app/characters/data';
const STAGE_SUBDIR = 'app/assets/stages';
export const STAGE_FILE_PREFIX = 'stages/';
const DATA_FILE_RE = /\.jsonc?$/i;

export class ElectronStorage implements StorageBackend {
  readonly kind = 'electron' as const;
  readonly canSave = true;
  private rootDir = '';
  private charDir = '';
  private stageDir = '';

  constructor(initialDir?: string) {
    if (initialDir) {
      this.setRoot(initialDir);
    }
  }

  get ready() {
    return this.hasDataDir(this.charDir) || this.hasDataDir(this.stageDir);
  }

  get label() {
    return this.rootDir || '(no directory selected)';
  }

  setRoot(dir: string) {
    const path = window.nodeAPI.path;
    this.rootDir = dir;
    this.charDir = path.resolve(dir, CHAR_SUBDIR);
    this.stageDir = path.resolve(dir, STAGE_SUBDIR);
  }

  private hasDataDir(dir: string): boolean {
    if (!dir) return false;
    try {
      return window.nodeAPI.fs.existsSync(dir);
    } catch {
      return false;
    }
  }

  async pickDirectory(): Promise<boolean> {
    const result = await window.electronAPI.showOpenDialog({
      title: 'Select Antistatic installation or repository directory',
      defaultPath: this.rootDir || undefined,
      properties: ['openDirectory'],
    });
    if (result.filePaths.length === 1) {
      this.setRoot(result.filePaths[0]);
      return true;
    }
    return false;
  }

  async list(): Promise<string[]> {
    if (!this.ready) return [];
    const files: string[] = [];
    if (this.hasDataDir(this.charDir)) {
      try {
        files.push(
          ...(window.nodeAPI.fs.readdirSync(this.charDir) as string[]).filter((name) =>
            DATA_FILE_RE.test(name)
          )
        );
      } catch (err) {
        console.warn('failed to list character data', err);
      }
    }
    if (this.hasDataDir(this.stageDir)) {
      try {
        files.push(
          ...(window.nodeAPI.fs.readdirSync(this.stageDir) as string[])
            .filter((name) => DATA_FILE_RE.test(name))
            .map((name) => `${STAGE_FILE_PREFIX}${name}`)
        );
      } catch (err) {
        console.warn('failed to list stage data', err);
      }
    }
    return files;
  }

  private resolveFile(name: string): string {
    const path = window.nodeAPI.path;
    if (name.startsWith(STAGE_FILE_PREFIX)) {
      return path.resolve(this.stageDir, path.basename(name));
    }
    return path.resolve(this.charDir, path.basename(name));
  }

  async read(name: string): Promise<string> {
    return window.nodeAPI.fs.readFileSync(this.resolveFile(name), 'utf8') as string;
  }

  async write(name: string, content: string): Promise<void> {
    // The preload performs the sibling-write/rename as one operation so the
    // renderer never exposes a partially-written JSON document to the game.
    window.nodeAPI.fs.writeFileAtomic(this.resolveFile(name), content);
  }

  watch(name: string, listener: () => void): () => void {
    const full = this.resolveFile(name);
    const path = window.nodeAPI.path;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    let cleanup = () => {};
    const retry = () => {
      if (stopped || retryTimer || retryCount >= 5) return;
      const delay = 100 * 2 ** retryCount++;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        start();
      }, delay);
    };
    const start = () => {
      if (stopped) return;
      try {
        // Watch the directory so atomic temp-file renames do not strand the
        // watcher on the old inode.
        cleanup = window.nodeAPI.fs.watch(
          path.dirname(full),
          (_event, changedName) => {
            if (changedName !== null && changedName.toString() !== path.basename(full)) return;
            listener();
          },
          () => {
            cleanup();
            retry();
          }
        );
      } catch {
        retry();
      }
    };
    start();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      cleanup();
    };
  }
}
