/**
 * Keyframe clipboard.
 *
 * Backs a copy/paste-across-animations workflow with localStorage so a
 * keyframe copied in one character/animation can be pasted into another
 * (and survives reloads). Falls back to an in-memory slot where
 * localStorage is unavailable (SSR / tests / privacy modes).
 */

import type { Keyframe } from '../types';
import { cloneKeyframe } from './keyframe-ops';

const KEY = 'antistatic-animator:kf-clipboard';
let memory: string | null = null;

const read = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memory;
  }
};

const write = (value: string): void => {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    memory = value;
  }
};

/** Copy a keyframe to the clipboard (deep-cloned + serialised). */
export const copyKeyframe = (kf: Keyframe): void => {
  write(JSON.stringify(cloneKeyframe(kf)));
};

/** Whether a keyframe is currently on the clipboard. */
export const hasClipboardKeyframe = (): boolean => read() != null;

/** Read a fresh clone of the clipboard keyframe, or null if empty/corrupt. */
export const pasteKeyframe = (): Keyframe | null => {
  const raw = read();
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as Keyframe;
    if (!parsed || typeof parsed !== 'object') return null;
    return cloneKeyframe(parsed);
  } catch {
    return null;
  }
};
