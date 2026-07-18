/**
 * Browser storage backend using the File System Access API.
 * Provides read+write to a user-selected character data directory.
 */

import { DATA_FILE_RE } from '../utils';
import type { StorageBackend } from './types';

const CHAR_PATH = ['app', 'characters', 'data'];
const STAGE_PATH = ['app', 'assets', 'stages'];
const STAGE_FILE_PREFIX = 'stages/';

// File System Access API typings vary by TS lib version; declare what we need.
export interface FsHandle {
  kind: 'file' | 'directory';
  name: string;
}
export interface FsDirHandle extends FsHandle {
  kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFileHandle>;
  values(): AsyncIterableIterator<FsHandle>;
  queryPermission?(d?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?(d?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
}
export interface FsFileHandle extends FsHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
}
export interface FsWritable {
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
  private stageHandle: FsDirHandle | null = null;
  private rootName = '';

  get ready() {
    return !!this.charHandle || !!this.stageHandle;
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
    this.stageHandle = null;
    this.rootName = handle.name;
    return true;
  }

  private async useHandle(handle: FsDirHandle) {
    this.rootName = handle.name;
    const findDirectory = async (segments: string[]): Promise<FsDirHandle | null> => {
      let current = handle;
      try {
        for (const segment of segments) current = await current.getDirectoryHandle(segment);
        return current;
      } catch {
        return null;
      }
    };
    this.charHandle = await findDirectory(CHAR_PATH);
    this.stageHandle = await findDirectory(STAGE_PATH);
    // A directly selected character directory retains the previous behavior.
    if (!this.charHandle && !this.stageHandle) {
      if (handle.name.toLowerCase() === 'stages') this.stageHandle = handle;
      else this.charHandle = handle;
    }
  }

  async list(): Promise<string[]> {
    const out: string[] = [];
    if (this.charHandle) {
      for await (const entry of this.charHandle.values()) {
        if (entry.kind === 'file' && DATA_FILE_RE.test(entry.name)) out.push(entry.name);
      }
    }
    if (this.stageHandle) {
      for await (const entry of this.stageHandle.values()) {
        if (entry.kind === 'file' && DATA_FILE_RE.test(entry.name)) {
          out.push(`${STAGE_FILE_PREFIX}${entry.name}`);
        }
      }
    }
    return out;
  }

  private fileLocation(name: string): { directory: FsDirHandle | null; name: string } {
    if (name.startsWith(STAGE_FILE_PREFIX)) {
      return { directory: this.stageHandle, name: name.slice(STAGE_FILE_PREFIX.length) };
    }
    return { directory: this.charHandle, name };
  }

  async read(name: string): Promise<string> {
    const location = this.fileLocation(name);
    if (!location.directory) throw new Error('no directory selected for this file type');
    const file = await location.directory.getFileHandle(location.name);
    const blob = await file.getFile();
    return blob.text();
  }

  async write(name: string, content: string): Promise<void> {
    const location = this.fileLocation(name);
    if (!location.directory) throw new Error('no directory selected for this file type');
    const file = await location.directory.getFileHandle(location.name, { create: true });
    const w = await file.createWritable();
    await w.write(content);
    await w.close();
  }
}
