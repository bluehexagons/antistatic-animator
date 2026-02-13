/**
 * Animator Module - Main Entry Point
 *
 * Exports all public APIs and components for the animator editor.
 */

// Types
export * from './types';

// Constants
export * from './constants';

// State
export { editing } from './state/EditingState';
export { dragging } from './state/DragState';
export { editorCamera } from './state/CameraState';

// Rendering
export { paintBubbles } from './rendering/bubble-painter';
export { findBubbles, hbmap } from './rendering/bubble-finder';
export { pathCircle, pathCapsule } from './rendering/canvas-utils';

// Operations
export * from './operations/file-operations';
export * from './operations/keyframe-ops';

// Events
export {
  initCanvasEvents,
  refreshEditor,
  downEditor,
  moveEditor,
  upEditor,
  keydownEditor,
  keyupEditor,
  keytick,
  resetHoverState,
  updateUI,
} from './events/canvas-events';

// API
export { createTools } from './api/tools';

// Components
export { StatsDisplay } from './components/StatsDisplay';
export { PropertyEditor } from './components/PropertyEditor';

// Hooks
export { useEditorCanvas } from './hooks/useEditorCanvas';

// Initialization
export {
  initAnimator,
  initAnimator as init, // Main init function called by react.tsx
  showEditor,
  clearUI,
  loadAnimation,
  getEditorCanvas,
  getEditorContext,
} from './init';
