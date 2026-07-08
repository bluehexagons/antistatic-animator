/**
 * Misc hooks shared by the shell.
 */

import { useRef, useSyncExternalStore } from 'react';
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

/**
 * Returns a stable ref whose `.current` always holds the latest value.
 * Useful in effects that must not re-attach when the captured value changes.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
