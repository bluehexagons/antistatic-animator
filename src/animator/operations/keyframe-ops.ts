/**
 * Keyframe manipulation operations
 * Functions for inserting, removing, swapping, and copying keyframes
 */

import type { EntityData, Animation, Keyframe, Hitbubble } from '../types';
import { objHas } from '../../utils';

/** Type for functions that reload and show editor */
export type LoadAnimationFn = (character: EntityData, animation: Animation) => void;
export type ShowEditorFn = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  updateCallback: () => void
) => void;
export type PreviewUpdateArray = (() => void)[];

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
    hurtbubbles: keyframe.hurtbubbles ? cloneHurtbubbles(keyframe.hurtbubbles) : null,
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
    if (key !== 'duration' && key !== 'hurtbubbles' && key !== 'hitbubbles') {
      (cloned as any)[key] = (keyframe as any)[key];
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

/**
 * Swap current keyframe with previous keyframe
 */
export const swapWithPrevious = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  loadAnimation: LoadAnimationFn,
  showEditor: ShowEditorFn,
  previewUpdate: PreviewUpdateArray
) => {
  const temp = animation.keyframes[keyframe];
  animation.keyframes[keyframe] = animation.keyframes[keyframe - 1];
  animation.keyframes[keyframe - 1] = temp;
  loadAnimation(character, animation);
  showEditor(character, animation, keyframe - 1, previewUpdate[keyframe - 1]);
};

/**
 * Copy hurtbubbles from current keyframe to previous keyframe
 */
export const copyToPrevious = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  loadAnimation: LoadAnimationFn
) => {
  const fromKF = animation.keyframes[keyframe].hurtbubbles;
  const toKF = animation.keyframes[keyframe - 1].hurtbubbles;
  for (let i = 0; i < fromKF.length && i < toKF.length; i++) {
    toKF[i] = fromKF[i];
  }
  loadAnimation(character, animation);
};

/**
 * Insert a new keyframe before the current one
 */
export const insertBefore = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  loadAnimation: LoadAnimationFn,
  showEditor: ShowEditorFn,
  previewUpdate: PreviewUpdateArray
) => {
  const kf = animation.keyframes[keyframe];
  const newKeyframe: Keyframe = {
    duration: kf.duration,
    hurtbubbles: null,
  };
  if (objHas(kf, 'hurtbubbles')) {
    newKeyframe.hurtbubbles = Array.from(kf.hurtbubbles);
  }
  animation.keyframes.splice(keyframe, 0, newKeyframe);
  loadAnimation(character, animation);
  showEditor(character, animation, keyframe, previewUpdate[keyframe]);
};

/**
 * Remove the current keyframe
 */
export const removeKeyframe = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  loadAnimation: LoadAnimationFn
) => {
  animation.keyframes.splice(keyframe, 1);
  loadAnimation(character, animation);
};

/**
 * Copy hurtbubbles from currently edited keyframe to target keyframe
 */
export const copyFromEditor = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  editingAnimation: Animation,
  editingKeyframe: number,
  loadAnimation: LoadAnimationFn,
  showEditor: ShowEditorFn,
  previewUpdate: PreviewUpdateArray
) => {
  const fromKF = editingAnimation.keyframes[editingKeyframe].hurtbubbles;
  const toKF = animation.keyframes[keyframe].hurtbubbles;
  for (let i = 0; i < fromKF.length && i < toKF.length; i++) {
    toKF[i] = fromKF[i];
  }
  loadAnimation(character, animation);
  showEditor(character, animation, keyframe, previewUpdate[keyframe]);
};

/**
 * Insert a new keyframe after the current one
 */
export const insertAfter = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  loadAnimation: LoadAnimationFn,
  showEditor: ShowEditorFn,
  previewUpdate: PreviewUpdateArray
) => {
  const kf = animation.keyframes[keyframe];
  const newKeyframe: Keyframe = {
    duration: kf.duration,
    hurtbubbles: null,
  };
  if (objHas(kf, 'hurtbubbles')) {
    newKeyframe.hurtbubbles = Array.from(kf.hurtbubbles);
  }
  animation.keyframes.splice(keyframe + 1, 0, newKeyframe);
  loadAnimation(character, animation);
  showEditor(character, animation, keyframe + 1, previewUpdate[keyframe + 1]);
};

/**
 * Copy hurtbubbles from current keyframe to next keyframe
 */
export const copyToNext = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  loadAnimation: LoadAnimationFn
) => {
  const fromKF = animation.keyframes[keyframe].hurtbubbles;
  const toKF = animation.keyframes[keyframe + 1].hurtbubbles;
  for (let i = 0; i < fromKF.length && i < toKF.length; i++) {
    toKF[i] = fromKF[i];
  }
  loadAnimation(character, animation);
};

/**
 * Swap current keyframe with next keyframe
 */
export const swapWithNext = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  loadAnimation: LoadAnimationFn,
  showEditor: ShowEditorFn,
  previewUpdate: PreviewUpdateArray
) => {
  const temp = animation.keyframes[keyframe];
  animation.keyframes[keyframe] = animation.keyframes[keyframe + 1];
  animation.keyframes[keyframe + 1] = temp;
  loadAnimation(character, animation);
  showEditor(character, animation, keyframe + 1, previewUpdate[keyframe + 1]);
};
