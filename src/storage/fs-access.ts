/**
 * Browser storage backend using the File System Access API.
 * Provides read+write to a user-selected character data directory.
 */

import type { StorageBackend } from './types';

const CHAR_PATH = ['app', 'characters', 'data'];
const DATA_FILE_RE = /\.jsonc?$/i;

// File System Access API typings vary by TS lib version; declare what we need.
interface FsHandle {
  kind: 'file' | 'directory';
  name: string;
}
interface FsDirHandle extends FsHandle {
  kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFileHandle>;
  values(): AsyncIterableIterator<FsHandle>;
  queryPermission?(d?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?(d?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}
interface FsFileHandle extends FsHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
}
interface FsWritable {
  write(data: string | Blob | ArrayBuffer): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: {
      mode?: 'read' | 'readwrite';
      id?: string;
    }) => Promise<FsDirHandle>;
  }
}

export class FsAccessStorage implements StorageBackend {
  readonly kind = 'fs-access' as const;
  readonly canSave = true;
  private charHandle: FsDirHandle | null = null;
  private rootName = '';

  get ready() {
    return !!this.charHandle;
  }

  get label() {
    return this.rootName || '(no folder selected)';
  }

  async pickRoot(): Promise<boolean> {
    if (!window.showDirectoryPicker) return false;
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'antistatic-root' });
    await this.useHandle(handle);
    return true;
  }

  async pickCharacterDir(): Promise<boolean> {
    if (!window.showDirectoryPicker) return false;
    const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'antistatic-chars' });
    this.charHandle = handle;
    this.rootName = handle.name;
    return true;
  }

  private async useHandle(handle: FsDirHandle) {
    this.rootName = handle.name;
    // Drill down to app/characters/data; if absent, fall back to the picked dir.
    let cur: FsDirHandle = handle;
    let ok = true;
    for (const seg of CHAR_PATH) {
      try {
        cur = await cur.getDirectoryHandle(seg);
      } catch {
        ok = false;
        break;
      }
    }
    this.charHandle = ok ? cur : handle;
  }

  async list(): Promise<string[]> {
    if (!this.charHandle) return [];
    const out: string[] = [];
    for await (const entry of this.charHandle.values()) {
      if (entry.kind === 'file' && DATA_FILE_RE.test(entry.name)) out.push(entry.name);
    }
    return out;
  }

  async read(name: string): Promise<string> {
    if (!this.charHandle) throw new Error('no directory selected');
    const file = await this.charHandle.getFileHandle(name);
    const blob = await file.getFile();
    return blob.text();
  }

  async write(name: string, content: string): Promise<void> {
    if (!this.charHandle) throw new Error('no directory selected');
    const file = await this.charHandle.getFileHandle(name, { create: true });
    const w = await file.createWritable();
    await w.write(content);
    await w.close();
  }
}
