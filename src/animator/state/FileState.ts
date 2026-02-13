/**
 * File state management
 * Tracks loaded character data, animation files, and UI references
 */

import type { EntityData, AnimationMap, Animation } from '../types';

/** DOM element references */
export let keyframesElement: HTMLElement | null = null;
export let bubblesElement: HTMLElement | null = null;
export let filesElement: HTMLSelectElement | null = null;
export let animationsElement: HTMLSelectElement | null = null;
export let editorHurtbubbles: HTMLDivElement | null = null;
export let editorCanvas: HTMLCanvasElement | null = null;
export let editorCtx: CanvasRenderingContext2D | null = null;
export let playerCanvas: HTMLCanvasElement | null = null;
export let playerCtx: CanvasRenderingContext2D | null = null;

/** Initialization flag */
export let initialized = false;

/** Currently loaded character */
export let character: EntityData | null = null;

/** Current animation file name */
export let animFile = '';

/** Parsed animation data */
export let parsed: AnimationMap | null = null;

/** Currently loaded animation */
export let loadedAnimation: Animation | null = null;

/** Set DOM element references */
export const setDOMElements = (elements: {
  keyframes?: HTMLElement;
  bubbles?: HTMLElement;
  files?: HTMLSelectElement;
  animations?: HTMLSelectElement;
  editorHurtbubbles?: HTMLDivElement;
  editorCanvas?: HTMLCanvasElement;
  playerCanvas?: HTMLCanvasElement;
}) => {
  if (elements.keyframes) keyframesElement = elements.keyframes;
  if (elements.bubbles) bubblesElement = elements.bubbles;
  if (elements.files) filesElement = elements.files;
  if (elements.animations) animationsElement = elements.animations;
  if (elements.editorHurtbubbles) editorHurtbubbles = elements.editorHurtbubbles;
  if (elements.editorCanvas) {
    editorCanvas = elements.editorCanvas;
    editorCtx = editorCanvas.getContext('2d');
  }
  if (elements.playerCanvas) {
    playerCanvas = elements.playerCanvas;
    playerCtx = playerCanvas.getContext('2d');
  }
};

/** Set initialization flag */
export const setInitialized = (value: boolean) => {
  initialized = value;
};

/** Set loaded character */
export const setCharacter = (char: EntityData | null) => {
  character = char;
};

/** Set animation file name */
export const setAnimFile = (filename: string) => {
  animFile = filename;
};

/** Set parsed animation data */
export const setParsed = (data: AnimationMap | null) => {
  parsed = data;
};

/** Set loaded animation */
export const setLoadedAnimation = (anim: Animation | null) => {
  loadedAnimation = anim;
};

/** Clear UI elements */
export const clearUI = () => {
  if (keyframesElement) {
    while (keyframesElement.firstChild) {
      keyframesElement.firstChild.remove();
    }
  }
  if (bubblesElement) {
    while (bubblesElement.firstChild) {
      bubblesElement.firstChild.remove();
    }
  }
};
