/**
 * Canvas Event Handlers
 *
 * Mouse and keyboard event handlers for the animation editor canvas.
 * These handlers are performance-critical and use vanilla JS for efficiency.
 */

import { Actions } from '../types';
import { editing } from '../state/EditingState';
import { dragging } from '../state/DragState';
import { editorCamera } from '../state/CameraState';
import { findBubbles } from '../rendering/bubble-finder';
import { paintBubbles } from '../rendering/bubble-painter';
import { direction, NUDGE_DELAY, SPEED } from '../constants';

/** Canvas element reference */
let editorCanvas: HTMLCanvasElement | null = null;
/** Canvas 2D context reference */
let editorCtx: CanvasRenderingContext2D | null = null;

/** Last hovered bubble index (-1 if none) */
let lastHovered = -1;
/** Whether we found a bubble on the last check */
let lastFound = false;

/** Array of update UI functions for each bubble */
export const updateUI: ((x: number, y: number, highlight: number) => void)[] = [];

/**
 * Initialize canvas event handlers
 */
export function initCanvasEvents(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  editorCanvas = canvas;
  editorCtx = ctx;
}

/**
 * Refresh the editor canvas (repaint all bubbles)
 */
export function refreshEditor() {
  if (!editorCanvas || !editorCtx) return;

  editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
  paintBubbles(
    editing.character,
    editing.animation,
    editing.keyframe,
    editorCtx,
    editorCamera.x,
    editorCamera.y,
    editorCanvas.width,
    editorCanvas.height,
    editorCamera.scale,
    lastHovered,
    editing.bubble
  );
}

/**
 * Find bubbles at the mouse position
 * Returns true if hover state changed
 */
export function editorFindBubbles(e: MouseEvent): boolean {
  if (!editorCanvas) return false;

  const bs = findBubbles(
    editing.character,
    editing.animation,
    editing.keyframe,
    editorCamera.x,
    editorCamera.y,
    editorCanvas.width,
    editorCanvas.height,
    editorCamera.scale,
    e.offsetX,
    e.offsetY
  );

  let hover = -1;
  if (bs.length !== 0) {
    hover = bs[0] * 0.25;
  }

  if (lastHovered === hover) {
    return false;
  }

  lastHovered = hover;
  return true;
}

/**
 * Mouse down event handler
 */
export function downEditor(e: MouseEvent) {
  if (editing.character === null || editing.animation === null) {
    return;
  }

  if (e.buttons === 1) {
    // Left click - select and drag bubble
    editorFindBubbles(e);

    dragging.active = lastHovered;
    editing.bubble = lastHovered;

    if (lastHovered === -1) {
      refreshEditor();
      return;
    }

    if (!editorCanvas) return;

    const keyframe = editing.animation.keyframes[editing.keyframe];
    const hbs = keyframe && keyframe.hurtbubbles;
    const hbIndex = lastHovered * 4;

    // Guard against missing hurtbubbles data or out-of-bounds access / missing UI
    if (
      !hbs ||
      !Array.isArray(hbs) ||
      hbIndex + 1 >= hbs.length ||
      typeof updateUI[lastHovered] !== 'function'
    ) {
      // Data/UI inconsistent: clear selection and refresh instead of entering move mode
      dragging.active = -1;
      editing.bubble = -1;
      lastHovered = -1;
      refreshEditor();
      return;
    }

    const x = (e.offsetX - editorCanvas.width * (0.5 + editorCamera.x * 0.5)) / editorCamera.scale;
    const y =
      -(e.offsetY - editorCanvas.height * (0.5 + editorCamera.y * 0.5)) / editorCamera.scale;

    dragging.action = Actions.moveHurtbubble;
    dragging.x = hbs[hbIndex] - x;
    dragging.y = hbs[hbIndex + 1] - y;

    refreshEditor();
    return;
  }

  if (e.buttons === 2) {
    // Right click - pan camera
    dragging.action = Actions.panCamera;
    dragging.startX = editorCamera.x;
    dragging.startY = editorCamera.y;
    dragging.x = e.offsetX;
    dragging.y = e.offsetY;
    return;
  }
}

/**
 * Mouse move event handler
 */
export function moveEditor(e: MouseEvent) {
  e.preventDefault();

  if (editing.character === null || editing.animation === null) {
    return;
  }

  if (!editorCanvas) return;

  switch (dragging.action) {
    case Actions.moveHurtbubble: {
      const ox = editorCamera.x;
      const oy = editorCamera.y;
      const w = editorCanvas.width;
      const h = editorCanvas.height;
      const x = (e.offsetX - w * (0.5 + ox * 0.5)) / editorCamera.scale;
      const y = -(e.offsetY - h * (0.5 + oy * 0.5)) / editorCamera.scale;

      updateUI[dragging.active]((dragging.x + x) | 0, (dragging.y + y) | 0, dragging.active);
      refreshEditor();
      return;
    }

    case Actions.panCamera:
      editorCamera.x =
        dragging.startX + ((e.offsetX - dragging.x) / editorCanvas.width) * editorCamera.scale;
      editorCamera.y =
        dragging.startY + ((e.offsetY - dragging.y) / editorCanvas.height) * editorCamera.scale;
      refreshEditor();
      return;
  }

  // Update hover state
  const newFound = editorFindBubbles(e);
  if (newFound !== lastFound) {
    refreshEditor();
    lastFound = newFound;
  }
}

/**
 * Mouse up event handler
 */
export function upEditor(e: MouseEvent) {
  if (
    editing.character === null ||
    editing.animation === null ||
    dragging.action === Actions.none
  ) {
    return;
  }

  moveEditor(e);
  dragging.active = -1;
  dragging.action = Actions.none;
  e.preventDefault();
}

/** Keyboard state tracking */
let keysdown = 0;

/** Keyboard tick timeout */
let keytickTimeout: number | null = null;
/** Keyboard tick animation frame ID */
let keytickAnimate = 0;
/** Start time for keyboard ticks */
let startTicks = 0;
/** Number of ticks processed */
let numTicks = 0;

/**
 * Keyboard tick handler for continuous movement
 * PERFORMANCE CRITICAL: Called at 60fps when keys are held
 */
export function keytick() {
  const difference = (((Date.now() - startTicks) / SPEED) | 0) - numTicks;

  for (let i = 0; i < difference; i++) {
    numTicks++;
    let dx = 0;
    let dy = 0;

    if (editing.bubble < 0) {
      return;
    }

    if (keysdown & direction.up) {
      dy++;
    }
    if (keysdown & direction.left) {
      dx--;
    }
    if (keysdown & direction.down) {
      dy--;
    }
    if (keysdown & direction.right) {
      dx++;
    }

    if (dx !== 0 || dy !== 0) {
      const b = editing.bubble;
      const hbs = editing.animation.keyframes[editing.keyframe].hurtbubbles;
      updateUI[b](hbs[b * 4] + dx, hbs[b * 4 + 1] + dy, b);
    }
  }

  keytickAnimate = requestAnimationFrame(keytick);
}

/**
 * Keydown event handler
 */
export function keydownEditor(e: KeyboardEvent) {
  let dx = 0;
  let dy = 0;

  if (editing.bubble < 0) {
    return;
  }

  switch (e.key) {
    case 'w':
    case 'ArrowUp':
      if (~keysdown & direction.up) {
        dy++;
        keysdown = keysdown | direction.up;
      }
      break;
    case 'a':
    case 'ArrowLeft':
      if (~keysdown & direction.left) {
        dx--;
        keysdown = keysdown | direction.left;
      }
      break;
    case 's':
    case 'ArrowDown':
      if (~keysdown & direction.down) {
        dy--;
        keysdown = keysdown | direction.down;
      }
      break;
    case 'd':
    case 'ArrowRight':
      if (~keysdown & direction.right) {
        dx++;
        keysdown = keysdown | direction.right;
      }
      break;
  }

  if (dx === 0 && dy === 0) {
    return;
  }

  e.preventDefault();

  // Start keyboard navigation if not already running
  if (keytickTimeout === null && keytickAnimate === 0) {
    startTicks = Date.now() + NUDGE_DELAY;
    numTicks = 0;
    keytickTimeout = setTimeout(() => {
      keytickTimeout = null;
      keytick();
    }, NUDGE_DELAY) as unknown as number;
  }

  // Immediate nudge
  const b = editing.bubble;
  const hbs = editing.animation.keyframes[editing.keyframe].hurtbubbles;
  updateUI[b](hbs[b * 4] + dx, hbs[b * 4 + 1] + dy, b);
}

/**
 * Keyup event handler
 */
export function keyupEditor(e: KeyboardEvent) {
  const wasStarted = keysdown !== 0;
  if (wasStarted) {
    e.preventDefault();
  }

  switch (e.key) {
    case 'w':
    case 'ArrowUp':
      keysdown = keysdown & ~direction.up;
      break;
    case 'a':
    case 'ArrowLeft':
      keysdown = keysdown & ~direction.left;
      break;
    case 's':
    case 'ArrowDown':
      keysdown = keysdown & ~direction.down;
      break;
    case 'd':
    case 'ArrowRight':
      keysdown = keysdown & ~direction.right;
      break;
  }

  // Stop keyboard navigation if no keys are held
  if (keysdown === 0) {
    cancelAnimationFrame(keytickAnimate);
    keytickAnimate = 0;

    if (keytickTimeout !== null) {
      clearTimeout(keytickTimeout);
      keytickTimeout = null;
    }
  }
}

/**
 * Reset last hovered state (useful when changing keyframes/animations)
 */
export function resetHoverState() {
  lastHovered = -1;
  lastFound = false;
}
