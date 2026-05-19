/**
 * Misc hooks shared by the shell.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { library } from '../storage/library';

/**
 * Subscribe to the global library and re-render on changes.
 */
export function useLibrary() {
  return useSyncExternalStore(
    (l) => library.subscribe(l),
    () => library.label + '|' + library.kind + '|' + library.files().length
  );
}

/**
 * Track an element's bounding rect; re-renders on resize.
 */
export function useElementSize<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    const r = el.getBoundingClientRect();
    setSize({ width: r.width, height: r.height });
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
