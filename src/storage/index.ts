/**
 * Storage entry point. Re-exports the backends and a helper that picks
 * the right one for the current runtime.
 */

export type { StorageBackend, StorageKind } from './types';
export { detectCapabilities } from './types';
export { ElectronStorage } from './electron';
export { FsAccessStorage } from './fs-access';
export { UploadStorage, collectFilesFromDrop } from './upload';
