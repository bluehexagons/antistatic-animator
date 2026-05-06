/**
 * Keyframe Utility Functions
 *
 * Pure functions for cloning and manipulating keyframe data.
 * State management and UI updates are handled by React components.
 */

import type { Animation, Keyframe, Hitbubble, Generic } from '../types';

/**
 * Clone a hurtbubbles array (deep copy)
 */
export const cloneHurtbubbles = (hurtbubbles: number[]): number[] => {
  return [...hurtbubbles];
};

/**
 * Clone a keyframe (deep copy)
 */
export const cloneKeyframe = (keyframe: Keyframe): Keyframe => {
  const cloned: Keyframe = {
    duration: keyframe.duration,
    hurtbubbles: keyframe.hurtbubbles ? cloneHurtbubbles(keyframe.hurtbubbles) : undefined,
  };

  // Handle hitbubbles
  if (keyframe.hitbubbles !== undefined) {
    if (keyframe.hitbubbles === true) {
      cloned.hitbubbles = true;
    } else if (Array.isArray(keyframe.hitbubbles)) {
      cloned.hitbubbles = keyframe.hitbubbles.map((hb) => ({ ...hb }));
    }
  }

  // Copy any additional properties
  for (const key in keyframe) {
    if (
      Object.prototype.hasOwnProperty.call(keyframe, key) &&
      key !== 'duration' &&
      key !== 'hurtbubbles' &&
      key !== 'hitbubbles'
    ) {
      (cloned as Generic)[key] = (keyframe as Generic)[key];
    }
  }

  return cloned;
};

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
