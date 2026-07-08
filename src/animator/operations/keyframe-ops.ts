/**
 * Keyframe Utility Functions
 *
 * Pure functions for cloning and manipulating keyframe data.
 * State management and UI updates are handled by React components.
 */

import type { Animation, Keyframe, Hitbubble } from '../types';

/**
 * Clone a hurtbubbles array (deep copy)
 */
export const cloneHurtbubbles = (hurtbubbles: readonly number[]): number[] => {
  return [...hurtbubbles];
};

/**
 * Recursive deep clone for plain JSON authoring data (arrays, objects,
 * primitives). Keyframes never hold class instances or functions in the
 * editor, so this is sufficient and avoids aliasing nested structures.
 */
const deepClone = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((v) => deepClone(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = deepClone((value as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  return value;
};

/**
 * Clone a keyframe (deep copy).
 *
 * Must be a *deep* copy: hitbubbles carry nested objects (`smear`, `audio`)
 * and keyframes carry nested overrides (`redirect`, `cancellable`, …) that
 * would otherwise alias between a clone and its source, so editing one would
 * silently mutate the other.
 */
export const cloneKeyframe = (keyframe: Keyframe): Keyframe => deepClone(keyframe);

/**
 * Resolve hitbubbles for a keyframe, following references to previous keyframes
 * Returns the actual hitbubbles array or null if not found
 */
export const resolveHitbubbles = (
  animation: Animation,
  keyframeIndex: number
): Hitbubble[] | null => {
  // Check bounds
  if (keyframeIndex < 0 || keyframeIndex >= animation.keyframes.length) {
    return null;
  }

  const kf = animation.keyframes[keyframeIndex];

  // No hitbubbles property
  if (kf.hitbubbles === undefined) {
    return null;
  }

  // Direct hitbubbles array
  if (Array.isArray(kf.hitbubbles)) {
    return kf.hitbubbles;
  }

  // Reference to previous keyframe (true)
  if (kf.hitbubbles === true && keyframeIndex > 0) {
    return resolveHitbubbles(animation, keyframeIndex - 1);
  }

  return null;
};
