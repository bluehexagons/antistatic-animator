import { ElectronStorage } from './electron';
import type { Library } from './library';

/** Select without mutating native authorization until edits may be discarded. */
export async function pickElectronSource(
  library: Library,
  confirmDiscardChanges: () => boolean
): Promise<ElectronStorage | null> {
  const backend = new ElectronStorage();
  const selected = await backend.pickDirectory();
  if (!selected || !confirmDiscardChanges()) return null;
  const previous = library.getBackend();
  try {
    backend.setRoot(selected);
    library.setBackend(backend);
    await library.refresh();
    return backend;
  } catch (error) {
    // The main process authorizes one project per renderer. Restore that root
    // before refreshing the retained backend or restarting its watchers.
    if (previous instanceof ElectronStorage) previous.setRoot(previous.label);
    if (library.getBackend() !== previous) {
      library.setBackend(previous);
      await library.refresh().catch(() => undefined);
    }
    throw error;
  }
}
