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

export class StorageConflictError extends Error {
  constructor(public readonly filename: string) {
    super(`File changed externally: ${filename}`);
    this.name = 'StorageConflictError';
  }
}

export interface LibraryFile {
  name: string;
  content: string;
}

export class Library {
  private backend: StorageBackend | null = null;
  private cache = new Map<string, string>();
  private listeners = new Set<LibraryListener>();
  private backendGeneration = 0;
  private backendRevision = 0;
  private revision = 0;
  private refreshGeneration = 0;
  private writeQueues = new Map<StorageBackend, Map<string, Promise<void>>>();

  setBackend(backend: StorageBackend | null) {
    this.backend = backend;
    this.backendGeneration++;
    this.backendRevision++;
    this.refreshGeneration++;
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

  get backendVersion(): number {
    return this.backendRevision;
  }

  get version(): number {
    return this.revision;
  }

  /** Force a re-list of files from the backend. */
  async refresh(): Promise<void> {
    const backend = this.backend;
    if (!backend) return;
    const backendGeneration = this.backendGeneration;
    const refreshGeneration = ++this.refreshGeneration;
    const next = new Map<string, string>();
    const names = await backend.list();
    for (const name of names) {
      try {
        next.set(name, await backend.read(name));
      } catch (err) {
        console.warn('failed to load', name, err);
      }
    }
    if (
      backend !== this.backend ||
      backendGeneration !== this.backendGeneration ||
      refreshGeneration !== this.refreshGeneration
    ) {
      return;
    }
    this.cache = next;
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
    const backend = this.backend;
    if (!backend) {
      this.cache.set(name, content);
      this.emit();
      return;
    }
    const backendGeneration = this.backendGeneration;
    let backendQueues = this.writeQueues.get(backend);
    if (!backendQueues) {
      backendQueues = new Map();
      this.writeQueues.set(backend, backendQueues);
    }
    const previous = backendQueues.get(name) ?? Promise.resolve();
    const operation = previous
      .catch(() => undefined)
      .then(async () => {
        if (backend !== this.backend || backendGeneration !== this.backendGeneration) return;
        if (backend.canSave) {
          let diskContent: string | undefined;
          try {
            const value = await backend.read(name);
            if (typeof value === 'string') diskContent = value;
          } catch {
            // A missing file is a valid first save. The backend write below
            // remains responsible for reporting permission and I/O errors.
          }
          const cachedContent = this.cache.get(name);
          if (cachedContent !== undefined && diskContent !== cachedContent) {
            throw new StorageConflictError(name);
          }
          if (cachedContent === undefined && diskContent !== undefined) {
            // The file appeared after the last refresh. Do not overwrite it
            // merely because it was not present in the cache.
            throw new StorageConflictError(name);
          }
          try {
            if (backend.writeIfUnchanged) {
              await backend.writeIfUnchanged(name, content, diskContent);
            } else {
              await backend.write(name, content);
            }
          } catch (error) {
            if (error instanceof Error && error.message.startsWith('File changed externally')) {
              throw new StorageConflictError(name);
            }
            throw error;
          }
        }
        // A slow write from an old source must not populate the new source's
        // cache after the user switches backends.
        if (backend === this.backend && backendGeneration === this.backendGeneration) {
          this.cache.set(name, content);
          this.emit();
        }
      });
    backendQueues.set(name, operation);
    try {
      await operation;
    } finally {
      if (backendQueues.get(name) === operation) backendQueues.delete(name);
      if (backendQueues.size === 0) this.writeQueues.delete(backend);
    }
  }

  /**
   * Watch a loaded file for changes made outside the animator. The backend
   * watcher can fire more than once for one write, so compare after a short
   * debounce and ignore changes that already match our cache.
   */
  watch(name: string, listener: (content: string) => void): () => void {
    const backend = this.backend;
    if (!backend?.watch) return () => {};
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    const check = (attempt = 0) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(
        () => {
          timer = null;
          void backend
            .read(name)
            .then((content) => {
              if (active && content !== this.cache.get(name)) listener(content);
            })
            .catch(() => {
              // A file may briefly disappear during an atomic replacement.
              if (active && attempt < 5) check(attempt + 1);
            });
        },
        attempt === 0 ? 50 : 100 * attempt
      );
    };
    const unwatch = backend.watch(name, check);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      unwatch();
    };
  }

  subscribe(listener: LibraryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.revision++;
    for (const l of this.listeners) l();
  }
}

export const library = new Library();
