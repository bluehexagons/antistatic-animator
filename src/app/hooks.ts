/**
 * Misc hooks shared by the shell.
 */

import { useSyncExternalStore } from 'react';
import { library } from '../storage/library';

/**
 * Subscribe to the global library and re-render on changes.
 */
export function useLibrary() {
  return useSyncExternalStore(
    (l) => library.subscribe(l),
    () => library.label + '|' + library.kind + '|' + library.size,
    () => library.label + '|' + library.kind + '|' + library.size
  );
}
