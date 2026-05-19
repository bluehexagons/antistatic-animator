/**
 * In-memory storage backend for browsers without the File System Access API.
 * Populated from drag-and-drop or an <input type="file" webkitdirectory> picker.
 *
 * Save isn't truly persistent — it triggers a browser download of the modified
 * JSON, which the user can drop back into their project.
 */

import type { StorageBackend } from './types';

export class UploadStorage implements StorageBackend {
  readonly kind = 'upload' as const;
  readonly canSave = true; // saves through download

  private files = new Map<string, string>();
  private dirLabel = '';

  get ready() {
    return this.files.size > 0;
  }

  get label() {
    return this.dirLabel || '(drop a folder to load)';
  }

  /** Load a flat list of files (basename → content) into memory. */
  async loadFiles(files: File[], label?: string): Promise<number> {
    this.files.clear();
    for (const f of files) {
      // Filter to character data files only — accept any folder layout.
      const text = await f.text();
      this.files.set(f.name, text);
    }
    this.dirLabel = label || (files[0] ? guessDirLabel(files) : '');
    return this.files.size;
  }

  async list(): Promise<string[]> {
    return [...this.files.keys()];
  }

  async read(name: string): Promise<string> {
    const v = this.files.get(name);
    if (v === undefined) throw new Error(`file not loaded: ${name}`);
    return v;
  }

  async write(name: string, content: string): Promise<void> {
    this.files.set(name, content);
    triggerDownload(name, content);
  }
}

function guessDirLabel(files: File[]): string {
  // Inspect webkitRelativePath if present.
  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (rel) return rel.split('/')[0];
  }
  return `${files.length} file${files.length === 1 ? '' : 's'}`;
}

function triggerDownload(name: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * Recursively gather File objects from a DataTransferItemList (drag-and-drop folder).
 */
export async function collectFilesFromDrop(items: DataTransferItemList): Promise<File[]> {
  const out: File[] = [];
  const promises: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const entry = (
      it as DataTransferItem & {
        webkitGetAsEntry?: () => FileSystemEntry | null;
      }
    ).webkitGetAsEntry?.();
    if (entry) {
      promises.push(walkEntry(entry, out));
    } else {
      const file = it.getAsFile();
      if (file) out.push(file);
    }
  }
  await Promise.all(promises);
  return out;
}

interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}
interface FileSystemFileEntry extends FileSystemEntry {
  file(cb: (f: File) => void, err?: (e: unknown) => void): void;
}
interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader(): FileSystemDirectoryReader;
}
interface FileSystemDirectoryReader {
  readEntries(cb: (entries: FileSystemEntry[]) => void, err?: (e: unknown) => void): void;
}

async function walkEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    const f = await new Promise<File>((resolve, reject) => {
      (entry as FileSystemFileEntry).file(resolve, reject);
    });
    out.push(f);
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const all: FileSystemEntry[] = [];
    // readEntries returns up to N entries at a time; loop until empty.
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      if (!batch.length) break;
      all.push(...batch);
    }
    await Promise.all(all.map((e) => walkEntry(e, out)));
  }
}
