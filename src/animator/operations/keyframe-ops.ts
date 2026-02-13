/**
 * Keyframe manipulation operations
 * Functions for inserting, removing, swapping, and copying keyframes
 */

import type { EntityData, Animation, Keyframe } from '../types';
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
