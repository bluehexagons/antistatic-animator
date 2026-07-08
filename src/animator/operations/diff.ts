/**
 * Session diff tracking.
 *
 * Records a baseline of an animation's keyframes the first time it is seen
 * this session, then reports which keyframes have been edited or newly added
 * since. Used to mark unsaved changes in the timeline.
 *
 * The baseline is keyed by the keyframes array reference (stable across the
 * editor's in-place edits — App shallow-clones the animation but keeps the
 * same keyframes array) and each keyframe is anchored by object identity.
 * A keyframe present in the baseline with a changed serialisation is
 * "edited"; one absent from the baseline is "new". Reordering keeps identity,
 * so it doesn't produce false positives.
 */

import type { Keyframe } from '../types';

const baselines = new Map<readonly Keyframe[], Map<Keyframe, string>>();

const serialize = (kf: Keyframe): string => JSON.stringify(kf);

/** Snapshot a keyframes array the first time it's seen. No-op after. */
export const ensureBaseline = (keyframes: readonly Keyframe[]): void => {
  if (baselines.has(keyframes)) return;
  const map = new Map<Keyframe, string>();
  for (const kf of keyframes) map.set(kf, serialize(kf));
  baselines.set(keyframes, map);
};

/** True when a keyframe was added or edited since the baseline snapshot. */
export const isKeyframeModified = (keyframes: readonly Keyframe[], kf: Keyframe): boolean => {
  const map = baselines.get(keyframes);
  if (!map) return false;
  if (!map.has(kf)) return true; // added this session
  return map.get(kf) !== serialize(kf); // edited in place
};

/** Forget one keyframes array's baseline (re-snapshotted on next sighting). */
export const resetBaseline = (keyframes: readonly Keyframe[]): void => {
  baselines.delete(keyframes);
};

/** Forget every baseline — e.g. after a successful save. */
export const clearBaselines = (): void => {
  baselines.clear();
};
