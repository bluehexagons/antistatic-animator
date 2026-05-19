/**
 * Animator Module — types, utilities, and shared state for the editor.
 * UI components live in `src/app/`.
 */

export * from './types';
export * from './constants';
export { findBubbles, hbmap } from './rendering/bubble-finder';
export * from './operations/file-operations';
export * from './operations/keyframe-ops';
export { createTools } from './api/tools';
export { AnimatorProvider, useAnimator } from './context/AnimatorContext';
export type { AppState, AppAction, CameraState } from './context/AnimatorContext';
