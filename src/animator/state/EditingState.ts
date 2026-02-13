/**
 * Editing state management
 * Tracks which character, animation, keyframe, and bubble are currently being edited
 */

import type { EditingState, EntityData, Animation } from '../types';

/** Global editing state - exposed on window for backward compatibility */
export const editing: EditingState = {
  character: null,
  animation: null,
  keyframe: 0,
  bubble: -1,
};

/** Set the current editing context */
export const setEditingContext = (
  character: EntityData | null,
  animation: Animation | null,
  keyframe: number,
  bubble = -1
) => {
  editing.character = character;
  editing.animation = animation;
  editing.keyframe = keyframe;
  editing.bubble = bubble;
};

/** Update just the current bubble selection */
export const setEditingBubble = (bubble: number) => {
  editing.bubble = bubble;
};

/** Update just the current keyframe */
export const setEditingKeyframe = (keyframe: number) => {
  editing.keyframe = keyframe;
};
