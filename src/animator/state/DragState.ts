/**
 * Drag state management
 * Tracks mouse drag operations (moving bubbles or panning camera)
 */

import { Actions, type DragState } from '../types';

/** Global drag state */
export const dragging: DragState = {
  active: -1,
  x: 0,
  y: 0,
  action: Actions.none,
  startX: 0,
  startY: 0,
};

/** Start a drag operation */
export const startDrag = (action: Actions, x: number, y: number, active = -1) => {
  dragging.action = action;
  dragging.x = x;
  dragging.y = y;
  dragging.startX = x;
  dragging.startY = y;
  dragging.active = active;
};

/** Update drag position */
export const updateDrag = (x: number, y: number) => {
  dragging.x = x;
  dragging.y = y;
};

/** End drag operation */
export const endDrag = () => {
  dragging.action = Actions.none;
  dragging.active = -1;
};

/** Check if currently dragging */
export const isDragging = () => dragging.action !== Actions.none;

/** Get drag delta from start position */
export const getDragDelta = () => ({
  dx: dragging.x - dragging.startX,
  dy: dragging.y - dragging.startY,
});
