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
  private unwatches = new Map<string, () => void>();

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
      files.push(
        ...(window.nodeAPI.fs.readdirSync(this.charDir) as string[]).filter((name) =>
          DATA_FILE_RE.test(name)
        )
      );
    }
    if (this.hasDataDir(this.stageDir)) {
      files.push(
        ...(window.nodeAPI.fs.readdirSync(this.stageDir) as string[])
          .filter((name) => DATA_FILE_RE.test(name))
          .map((name) => `${STAGE_FILE_PREFIX}${name}`)
      );
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
    window.nodeAPI.fs.writeFileSync(this.resolveFile(name), content, {
      encoding: 'utf8',
    });
  }

  watch(name: string, listener: () => void): () => void {
    const full = this.resolveFile(name);
    try {
      const cleanup = window.nodeAPI.fs.watch(full, () => listener());
      this.unwatches.set(name, cleanup);
      return () => {
        cleanup();
        this.unwatches.delete(name);
      };
    } catch {
      return () => {};
    }
  }
}
