/**
 * Platform-agnostic storage interface.
 *
 * Backends:
 *  - electron: native fs through window.nodeAPI (used by the desktop app)
 *  - fs-access: File System Access API (Chromium-based browsers)
 *  - upload: drag-and-drop / file picker fallback (in-memory)
 */

export type StorageKind = 'electron' | 'fs-access' | 'upload';

export interface StorageBackend {
  readonly kind: StorageKind;
  /** Human-readable label for the current source (e.g. directory name). */
  readonly label: string;
  /** True once the user has granted access to a source. */
  readonly ready: boolean;
  /** Whether saving back is supported by this backend. */
  readonly canSave: boolean;

  /** List all file basenames in the character-data directory. */
  list(): Promise<string[]>;
  /** Read a file's text content by basename. */
  read(name: string): Promise<string>;
  /** Write a file's text content. May reject when {@link canSave} is false. */
  write(name: string, content: string): Promise<void>;

  /** Optional cooperative watch — returns an unsubscribe handle. */
  watch?(name: string, listener: () => void): () => void;
}

export interface StorageCapabilities {
  hasElectron: boolean;
  hasFsAccess: boolean;
}

export const detectCapabilities = (): StorageCapabilities => ({
  hasElectron: typeof window !== 'undefined' && !!window.nodeAPI && !!window.electronAPI,
  hasFsAccess:
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function',
});
