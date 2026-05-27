import { describe, it, expect, beforeEach } from 'vitest';
import {
  copyKeyframe,
  hasClipboardKeyframe,
  pasteKeyframe,
} from '../animator/operations/clipboard';
import {
  ensureBaseline,
  isKeyframeModified,
  resetBaseline,
  clearBaselines,
} from '../animator/operations/diff';
import type { Keyframe } from '../animator/types';

const kf = (over: Partial<Keyframe> = {}): Keyframe => ({
  duration: 3,
  hurtbubbles: [0, 0, 9, 1, 5, 5, 4, 1],
  ...over,
});

describe('clipboard', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* memory fallback */
    }
  });

  it('round-trips a keyframe through copy/paste', () => {
    expect(hasClipboardKeyframe()).toBe(false);
    const original = kf({ tween: 'sineInOut' });
    copyKeyframe(original);
    expect(hasClipboardKeyframe()).toBe(true);
    const pasted = pasteKeyframe();
    expect(pasted).toEqual(original);
  });

  it('returns a deep clone, not the original reference', () => {
    const original = kf();
    copyKeyframe(original);
    const pasted = pasteKeyframe()!;
    expect(pasted).not.toBe(original);
    (pasted.hurtbubbles as number[])[0] = 999;
    expect((original.hurtbubbles as number[])[0]).toBe(0);
  });

  it('two pastes yield independent copies', () => {
    copyKeyframe(kf());
    const a = pasteKeyframe()!;
    const b = pasteKeyframe()!;
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('diff baseline tracking', () => {
  beforeEach(() => clearBaselines());

  it('reports nothing modified right after baseline', () => {
    const keyframes = [kf(), kf({ duration: 5 })];
    ensureBaseline(keyframes);
    expect(isKeyframeModified(keyframes, keyframes[0])).toBe(false);
    expect(isKeyframeModified(keyframes, keyframes[1])).toBe(false);
  });

  it('detects an in-place edit', () => {
    const keyframes = [kf()];
    ensureBaseline(keyframes);
    keyframes[0].duration = 99;
    expect(isKeyframeModified(keyframes, keyframes[0])).toBe(true);
  });

  it('treats a newly added keyframe as modified', () => {
    const keyframes = [kf()];
    ensureBaseline(keyframes);
    const added = kf({ duration: 1 });
    keyframes.push(added);
    expect(isKeyframeModified(keyframes, added)).toBe(true);
  });

  it('ensureBaseline is idempotent (does not re-snapshot after edits)', () => {
    const keyframes = [kf()];
    ensureBaseline(keyframes);
    keyframes[0].duration = 42;
    ensureBaseline(keyframes); // must NOT capture the edited state
    expect(isKeyframeModified(keyframes, keyframes[0])).toBe(true);
  });

  it('resetBaseline re-snapshots on next ensure', () => {
    const keyframes = [kf()];
    ensureBaseline(keyframes);
    keyframes[0].duration = 7;
    resetBaseline(keyframes);
    ensureBaseline(keyframes);
    expect(isKeyframeModified(keyframes, keyframes[0])).toBe(false);
  });

  it('untracked arrays report not-modified', () => {
    const keyframes = [kf()];
    expect(isKeyframeModified(keyframes, keyframes[0])).toBe(false);
  });
});
