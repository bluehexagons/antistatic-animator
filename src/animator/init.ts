/**
 * Animator Initialization
 *
 * Main entry point for the animator editor.
 * Sets up the UI, event handlers, and global state.
 */

import * as JSONC from 'jsonc-parser';
import type { EntityData, Animation, AnimationMap } from './types';
import { editing } from './state/EditingState';
import { editorCamera } from './state/CameraState';
import { initCanvasEvents, updateUI, resetHoverState } from './events/canvas-events';
import { paintBubbles } from './rendering/bubble-painter';
import { createTools } from './api/tools';
import {
  makePropDisplay,
  makeStatDisplay,
  keyframeCopier,
  bubblePreview,
  previewUpdate,
} from './ui/ui-builders';
import { save as saveFile } from './operations/file-operations';
import { characterData, objHas, watchCharacters } from '../utils';

/** Wrapper for save operation */
function save() {
  if (animFile === '' || !parsed) {
    return;
  }
  saveFile(animFile, parsed);
}

/** Global window augmentation */
declare global {
  interface Window {
    editing: typeof editing;
    Tools: ReturnType<typeof createTools>;
    parsed: AnimationMap;
  }
}

/** Canvas elements */
let editorCanvas: HTMLCanvasElement | null = null;
let editorCtx: CanvasRenderingContext2D | null = null;

/** Container elements */
let keyframesElement: HTMLElement | null = null;
let bubblesElement: HTMLElement | null = null;
let editorHurtbubbles: HTMLDivElement | null = null;
let editorDiv: HTMLDivElement | null = null;

/** File state */
let filesElement: HTMLSelectElement | null = null;
let animationsElement: HTMLSelectElement | null = null;
let character: EntityData | null = null;
let animFile = '';
let parsed: AnimationMap = {};
let loadedAnimation: Animation | null = null;
let initialized = false;

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
 * Populate a select element with options
 */
function populateSelect(select: HTMLSelectElement, options: string[]) {
  while (select.options.length > 0) {
    select.options.remove(0);
  }
  for (let i = 0; i < options.length; i++) {
    const option = document.createElement('option');
    option.text = options[i];
    select.add(option);
  }
}

/**
 * Load an animation into the editor
 */
export function loadAnimation(character: EntityData, anim: Animation) {
  if (!keyframesElement || !bubblesElement || !editorDiv || !editorCanvas || !editorCtx) return;

  const animDiv = makePropDisplay(anim);
  const statDiv = makeStatDisplay(anim);

  clearUI();
  previewUpdate.length = 0;
  editing.bubble = -1;
  keyframesElement.appendChild(animDiv);
  keyframesElement.appendChild(statDiv);
  keyframesElement.appendChild(editorDiv);

  loadedAnimation = anim;
  if (!objHas(anim, 'keyframes')) {
    return;
  }

  const keyframes = anim.keyframes;
  for (let i = 0; i < keyframes.length; i++) {
    const props = makePropDisplay(keyframes[i], true);
    if (objHas(keyframes[i], 'hurtbubbles')) {
      props.insertBefore(
        bubblePreview(character, anim, i, editorCanvas, editorCtx),
        props.firstChild
      );
    }
    props.insertBefore(
      keyframeCopier(character, anim, i, loadAnimation, showEditor),
      props.firstChild
    );
    bubblesElement.appendChild(props);
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
export function initAnimator() {
  keyframesElement = document.getElementById('keyframes') as HTMLElement;
  bubblesElement = document.getElementById('bubbles') as HTMLElement;
  filesElement = document.getElementById('files') as HTMLSelectElement;
  animationsElement = document.getElementById('animations') as HTMLSelectElement;

  document.getElementById('save_button')?.addEventListener('click', save);

  startAnimator();
}

/**
 * Start the animator (create canvases and set up event handlers)
 */
function startAnimator() {
  if (!initialized) {
    initialized = true;

    // Create editor container
    editorDiv = document.createElement('div');
    editorDiv.className = 'editor';

    // Create hurtbubbles editor
    editorHurtbubbles = document.createElement('div');
    editorHurtbubbles.className = 'edit-hurtbubbles';
    editorDiv.appendChild(editorHurtbubbles);

    // Create editor canvas
    editorCanvas = document.createElement('canvas');
    editorCanvas.width = 300;
    editorCanvas.height = 200;
    editorCanvas.style.width = '300px';
    editorCanvas.style.height = '200px';
    editorDiv.appendChild(editorCanvas);
    editorCtx = editorCanvas.getContext('2d');
    editorCanvas.style.cursor = 'default';
    editorCanvas.tabIndex = 0;

    if (!editorCtx) {
      throw new Error('Failed to get 2D context from canvas');
    }

    // Initialize canvas events
    initCanvasEvents(editorCanvas, editorCtx);

    // Prevent double-click selection
    editorCanvas.addEventListener('dblclick', (e) => {
      e.preventDefault();
      return false;
    });
    editorCanvas.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });

    // Populate file selector
    if (!characterData) {
      console.error('characterData is not available');
      return;
    }

    const dirFiles = ['[File]'].concat(
      Array.from(characterData.keys())
        .filter((file: string) => !file.includes('_'))
        .sort() as any // eslint-disable-line @typescript-eslint/no-explicit-any
    );

    populateSelect(filesElement!, dirFiles);

    // File selection handler
    filesElement!.addEventListener('change', () => {
      if (filesElement!.selectedIndex === 0) {
        return;
      }
      const file = filesElement!.value;
      animFile = `${file.split('.')[0]}_anim.json`;
      character = JSONC.parse(characterData.get(file).content) as EntityData;
      if (characterData.has(animFile)) {
        parsed = JSONC.parse(characterData.get(animFile).content);
        console.log('Animation data is window.parsed');
        window.parsed = parsed;
        const anims = Object.getOwnPropertyNames(parsed);
        anims.sort();
        populateSelect(animationsElement!, anims);
      } else {
        populateSelect(animationsElement!, []);
      }
    });

    // Animation selection handler
    animationsElement!.addEventListener('change', () => {
      if (character && parsed && animationsElement!.value) {
        loadAnimation(character, parsed[animationsElement!.value]);
      }
    });

    // Watch for character file changes
    watchCharacters((name: string) => {
      console.log('animator reloading', name);
    });

    // Expose editing state globally for console access
    window.editing = editing;
    console.log('character is window.editing');

    // Create and expose Tools API
    window.Tools = createTools(
      () => parsed,
      () => loadedAnimation,
      () => animFile
    );
    console.log('Utils accessed with window.Tools');
  }
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
