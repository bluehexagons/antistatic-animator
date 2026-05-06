/**
 * Animator Initialization (Deprecated)
 *
 * This module is no longer used. The animator has been converted to a fully React-based
 * architecture with state management via AnimatorContext.
 *
 * See src/react.tsx for the new entry point and src/animator/context/AnimatorContext.tsx
 * for state management.
 */

// Stubs for backwards compatibility
export function initAnimator() {
  console.warn('initAnimator is deprecated. The animator is now initialized via React.');
}

export function showEditor() {
  console.warn('showEditor is deprecated. Use AnimatorContext to manage state.');
}

export function clearUI() {
  console.warn('clearUI is deprecated.');
}

export function loadAnimation() {
  console.warn('loadAnimation is deprecated. Use AnimatorContext to manage state.');
}

export function getEditorCanvas() {
  console.warn('getEditorCanvas is deprecated.');
  return null;
}

export function getEditorContext() {
  console.warn('getEditorContext is deprecated.');
  return null;
}
