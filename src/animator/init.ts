/**
 * Animator Initialization
 *
 * Main entry point for the animator editor.
 * Sets up the UI, event handlers, and global state.
 */

import type { EntityData, Animation } from './types';
import { editing } from './state/EditingState';
import { editorCamera } from './state/CameraState';
import { initCanvasEvents, updateUI, resetHoverState } from './events/canvas-events';
import { paintBubbles } from './rendering/bubble-painter';
import { createTools } from './api/tools';

/** Global window augmentation */
declare global {
  interface Window {
    editing: typeof editing;
    Tools: ReturnType<typeof createTools>;
  }
}

/** Canvas elements */
let editorCanvas: HTMLCanvasElement | null = null;
let editorCtx: CanvasRenderingContext2D | null = null;

/** Container elements */
let keyframesElement: HTMLElement | null = null;
let bubblesElement: HTMLElement | null = null;
let editorHurtbubbles: HTMLDivElement | null = null;

/** Preview update callbacks */
export const previewUpdate: (() => void)[] = [];

/**
 * Clear UI containers
 */
export function clearUI() {
  if (!keyframesElement || !bubblesElement) return;

  while (keyframesElement.firstChild) {
    keyframesElement.removeChild(keyframesElement.firstChild);
  }
  while (bubblesElement.firstChild) {
    bubblesElement.removeChild(bubblesElement.firstChild);
  }
}

/**
 * Create keyframe editor UI
 */
function makeKeyframeEditor(
  element: HTMLElement,
  character: EntityData,
  animation: Animation,
  keyframe: number,
  updateThumbnail: () => void
) {
  if (!editorCanvas || !editorCtx) return;

  const kf = animation.keyframes[keyframe];
  const hb = kf.hurtbubbles;
  updateUI.length = 0;

  for (let i = 0; i < hb.length; i = i + 4) {
    ((n: number, hb: number[]) => {
      const line = document.createElement('div');
      const x = document.createElement('span');
      const y = document.createElement('span');
      const r = document.createElement('span');
      const t = document.createElement('span');

      x.contentEditable = 'true';
      x.className = 'input';
      y.contentEditable = 'true';
      y.className = 'input';
      r.contentEditable = 'true';
      r.className = 'input';
      t.contentEditable = 'true';
      t.className = 'input';

      x.textContent = hb[n].toString(10);
      y.textContent = hb[n + 1].toString(10);
      r.textContent = hb[n + 2].toString(10);
      t.textContent = hb[n + 3].toString(10);

      line.appendChild(x);
      line.appendChild(document.createTextNode(','));
      line.appendChild(y);
      line.appendChild(document.createTextNode(' (r='));
      line.appendChild(r);
      line.appendChild(document.createTextNode(', state='));
      line.appendChild(t);
      line.appendChild(document.createTextNode(')'));

      const update = () => {
        if (!editorCanvas || !editorCtx) return;

        const scale = 2;
        const focused = line.contains(document.activeElement) ? n * 0.25 : -1;

        hb[n] = parseFloat(x.textContent || '0');
        hb[n + 1] = parseFloat(y.textContent || '0');
        hb[n + 2] = parseFloat(r.textContent || '0');
        hb[n + 3] = parseFloat(t.textContent || '0');

        editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
        paintBubbles(
          character,
          animation,
          keyframe,
          editorCtx,
          editorCamera.x,
          editorCamera.y,
          editorCanvas.width,
          editorCanvas.height,
          scale,
          focused
        );
        updateThumbnail();
      };

      const updateCoords = (xc: number, yc: number, highlight: number) => {
        if (!editorCanvas || !editorCtx) return;

        const scale = 2;
        x.textContent = xc.toString(10);
        y.textContent = yc.toString(10);
        hb[n] = xc;
        hb[n + 1] = yc;

        editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
        paintBubbles(
          character,
          animation,
          keyframe,
          editorCtx,
          editorCamera.x,
          editorCamera.y,
          editorCanvas.width,
          editorCanvas.height,
          scale,
          highlight
        );
        updateThumbnail();
      };

      updateUI.push(updateCoords);

      const testKey = (e: KeyboardEvent) => {
        let dx = 0;
        let dy = 0;

        switch (e.key) {
          case 'Enter':
            update();
            e.preventDefault();
            return false;
          case 'w':
            dy = 1;
            break;
          case 'd':
            dx = 1;
            break;
          case 's':
            dy = -1;
            break;
          case 'a':
            dx = -1;
            break;
        }

        if (dx !== 0 || dy !== 0) {
          updateCoords(
            hb[n] + dx,
            hb[n + 1] + dy,
            line.contains(document.activeElement) ? n * 0.25 : -1
          );
          e.preventDefault();
          return false;
        }
        return true;
      };

      [x, y, r, t].forEach((e) => {
        e.addEventListener('keydown', testKey);
        e.addEventListener('blur', update);
        e.addEventListener('focus', update);
      });

      element.appendChild(line);
    })(i, hb);
  }
}

/**
 * Show editor for a specific keyframe
 */
export function showEditor(
  character: EntityData,
  animation: Animation,
  keyframe: number,
  updateThumbnail: () => void
) {
  if (!editorCanvas || !editorCtx || !editorHurtbubbles || !bubblesElement) return;

  // Clear hurtbubble editor
  while (editorHurtbubbles.firstChild) {
    editorHurtbubbles.removeChild(editorHurtbubbles.firstChild);
  }

  // Build hurtbubble editor
  makeKeyframeEditor(editorHurtbubbles, character, animation, keyframe, updateThumbnail);

  // Update editing state
  editorCtx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
  editing.character = character;
  editing.animation = animation;
  editing.keyframe = keyframe;
  editing.bubble = -1;

  // Repaint canvas
  paintBubbles(
    character,
    animation,
    keyframe,
    editorCtx,
    editorCamera.x,
    editorCamera.y,
    editorCanvas.width,
    editorCanvas.height,
    editorCamera.scale
  );

  // Highlight current keyframe
  for (let i = 0; i < bubblesElement.children.length; i++) {
    bubblesElement.children[i].classList.remove('highlighted');
  }
  bubblesElement.children[keyframe].classList.add('highlighted');

  resetHoverState();
}

/**
 * Initialize the animator
 */
export function initAnimator(
  canvasElement: HTMLCanvasElement,
  keyframesContainer: HTMLElement,
  bubblesContainer: HTMLElement,
  hurtbubblesContainer: HTMLDivElement
) {
  editorCanvas = canvasElement;
  editorCtx = canvasElement.getContext('2d');
  keyframesElement = keyframesContainer;
  bubblesElement = bubblesContainer;
  editorHurtbubbles = hurtbubblesContainer;

  if (!editorCtx) {
    throw new Error('Failed to get 2D context from canvas');
  }

  // Initialize canvas events
  initCanvasEvents(editorCanvas, editorCtx);

  // Expose editing state globally for console access
  window.editing = editing;
  console.log('character is window.editing');

  // Create and expose Tools API
  // Note: Tools API requires parsed animation data and file state
  // These will be populated by the application layer
  window.Tools = createTools(
    () => null, // getParsed - to be updated by app
    () => editing.animation, // getLoadedAnimation
    () => '' // getAnimFile - to be updated by app
  );
  console.log('Utils accessed with window.Tools');
}

/**
 * Get current canvas context
 */
export function getEditorContext() {
  return editorCtx;
}

/**
 * Get current canvas element
 */
export function getEditorCanvas() {
  return editorCanvas;
}
