/**
 * Small shared utilities. Storage and watching has moved to `./storage/`.
 */

import type { Generic } from './animator/types';

export const objHas = (o: object, prop: string | number | symbol) =>
  Object.prototype.hasOwnProperty.call(o, prop);

export const objDiff = (a: Record<string, Generic>, b: Record<string, Generic>) => {
  const added: string[] = [];
  const removed: string[] = [];

  for (const key in b) {
    if (!objHas(b, key)) continue;
    if (!objHas(a, key)) added.push(key);
  }

  for (const key in a) {
    if (!objHas(a, key)) continue;
    if (!objHas(b, key)) removed.push(key);
  }

  return [added, removed];
};
