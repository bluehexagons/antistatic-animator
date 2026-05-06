/**
 * Animator Module - Main Entry Point
 *
 * Exports React components, context, and utilities for the animator editor.
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Utilities
export { findBubbles, hbmap } from './rendering/bubble-finder';
export * from './operations/file-operations';
export * from './operations/keyframe-ops';
export { createTools } from './api/tools';

// React Components
export { StatsDisplay } from './components/StatsDisplay';
export { PropertyEditor } from './components/PropertyEditor';
export { BubbleViewer } from './components/BubbleViewer';
export { BubblePreview } from './components/BubblePreview';
export { HurtbubbleEditor } from './components/HurtbubbleEditor';
export { KeyframeCopier } from './components/KeyframeCopier';
export { KeyframeList } from './components/KeyframeList';

// State Management
export { AnimatorProvider, useAnimator } from './context/AnimatorContext';
export type { AppState, AppAction, CameraState } from './context/AnimatorContext';
