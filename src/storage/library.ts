/**
 * Library — a thin reactive wrapper around a StorageBackend that
 * caches loaded character/animation files and notifies subscribers
 * when the contents change.
 *
 * Components subscribe via `subscribe(listener)` and read the current
 * snapshot through `files`/`label`.
 */

import type { StorageBackend } from './types';

export type LibraryListener = () => void;

export interface LibraryFile {
  name: string;
  content: string;
}

export class Library {
  private backend: StorageBackend | null = null;
  private cache = new Map<string, string>();
  private listeners = new Set<LibraryListener>();

  setBackend(backend: StorageBackend | null) {
    this.backend = backend;
    this.cache.clear();
    this.emit();
  }

  getBackend(): StorageBackend | null {
    return this.backend;
  }

  get kind(): string {
    return this.backend?.kind ?? 'none';
  }

  get label(): string {
    return this.backend?.label ?? '(no source)';
  }

  get ready(): boolean {
    return !!this.backend?.ready;
  }

  /** Number of cached files (avoids allocating an array via files()). */
  get size(): number {
    return this.cache.size;
  }

  get canSave(): boolean {
    return !!this.backend?.canSave;
  }

  /** Force a re-list of files from the backend. */
  async refresh(): Promise<void> {
    if (!this.backend) return;
    this.cache.clear();
    const names = await this.backend.list();
    for (const name of names) {
      try {
        this.cache.set(name, await this.backend.read(name));
      } catch (err) {
        console.warn('failed to load', name, err);
      }
    }
    this.emit();
  }

  files(): LibraryFile[] {
    return [...this.cache.entries()].map(([name, content]) => ({ name, content }));
  }

  has(name: string): boolean {
    return this.cache.has(name);
  }

  get(name: string): string | undefined {
    return this.cache.get(name);
  }

  /** Update local cache; persistence depends on the backend. */
  async save(name: string, content: string): Promise<void> {
    this.cache.set(name, content);
    if (this.backend?.canSave) {
      await this.backend.write(name, content);
    }
    this.emit();
  }

  subscribe(listener: LibraryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l();
  }
}

export const library = new Library();
