/**
 * Camera state management
 * Controls viewport position and zoom for the editor canvas
 */

import type { CameraState } from '../types';

/** Global camera state */
export const editorCamera: CameraState = {
  x: 0,
  y: 0.1,
  scale: 2,
};

/** Set camera position */
export const setCameraPosition = (x: number, y: number) => {
  editorCamera.x = x;
  editorCamera.y = y;
};

/** Set camera zoom scale */
export const setCameraScale = (scale: number) => {
  editorCamera.scale = Math.max(0.1, Math.min(10, scale)); // Clamp between 0.1 and 10
};

/** Pan camera by delta */
export const panCamera = (dx: number, dy: number) => {
  editorCamera.x += dx;
  editorCamera.y += dy;
};

/** Reset camera to default position */
export const resetCamera = () => {
  editorCamera.x = 0;
  editorCamera.y = 0.1;
  editorCamera.scale = 2;
};
