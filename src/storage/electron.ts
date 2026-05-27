/**
 * Electron storage backend — reads/writes the user-selected game directory
 * via the preload-exposed Node fs API.
 */

import type { StorageBackend } from './types';

const CHAR_SUBDIR = 'app/characters/data';
const DATA_FILE_RE = /\.jsonc?$/i;

export class ElectronStorage implements StorageBackend {
  readonly kind = 'electron' as const;
  readonly canSave = true;
  private rootDir = '';
  private charDir = '';
  private unwatches = new Map<string, () => void>();

  constructor(initialDir?: string) {
    if (initialDir) {
      this.setRoot(initialDir);
    }
  }

  get ready() {
    return this.hasCharacterDataDir();
  }

  get label() {
    return this.rootDir || '(no directory selected)';
  }

  setRoot(dir: string) {
    const path = window.nodeAPI.path;
    this.rootDir = dir;
    this.charDir = path.resolve(dir, CHAR_SUBDIR);
  }

  private hasCharacterDataDir(): boolean {
    if (!this.charDir) return false;
    try {
      return window.nodeAPI.fs.existsSync(this.charDir);
    } catch {
      return false;
    }
  }

  async pickDirectory(): Promise<boolean> {
    const result = await window.electronAPI.showOpenDialog({
      title: 'Select Antistatic installation directory',
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
    return (window.nodeAPI.fs.readdirSync(this.charDir) as string[]).filter((name) =>
      DATA_FILE_RE.test(name)
    );
  }

  async read(name: string): Promise<string> {
    const path = window.nodeAPI.path;
    return window.nodeAPI.fs.readFileSync(path.resolve(this.charDir, name), 'utf8') as string;
  }

  async write(name: string, content: string): Promise<void> {
    const path = window.nodeAPI.path;
    window.nodeAPI.fs.writeFileSync(path.resolve(this.charDir, name), content, {
      encoding: 'utf8',
    });
  }

  watch(name: string, listener: () => void): () => void {
    const path = window.nodeAPI.path;
    const full = path.resolve(this.charDir, name);
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
