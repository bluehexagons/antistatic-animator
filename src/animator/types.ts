/**
 * Type definitions for the animator module
 */

/**
 * Generic type for dynamic/unknown properties
 * Used when objects have runtime properties that cannot be statically typed
 */
export type Generic = any;

/** Action types for drag operations */
export const enum Actions {
  none = 0,
  moveHurtbubble = 1,
  panCamera = 2,
}

/** Character hurtbubble bone definition */
export type HurtbubbleData = {
  name: string;
  i1: number;
  i2: number;
  z: number;
  ik: boolean;
};

/** Attack hitbox definition */
export type Hitbubble = {
  [prop: string]: Generic; // Legacy: dynamic properties
  x?: number;
  y?: number;
  radius?: number;
  follow?: string;
  type?: string;
};

/** Hurtbubble coordinate (stored as flat array of numbers) */
export type Hurtbubble = number;

/** Animation keyframe */
export type Keyframe = {
  duration: number;
  hitbubbles?: Hitbubble[] | true; // true = reference to previous keyframe
  hurtbubbles?: Hurtbubble[];
};

/** Animation definition */
export type Animation = {
  [property: string]: Generic; // Legacy: dynamic properties
  keyframes: Keyframe[];
};

/** Map of animation names to Animation objects */
export type AnimationMap = {
  [name: string]: Animation;
};

/** Character entity data */
export type EntityData = {
  name: string;
  hurtbubbles: HurtbubbleData[];
  [name: string]: Generic; // Legacy: dynamic properties
};

/** UI multichoice dropdown configuration */
export type Multichoices = {
  default: string;
  choices: string[];
};

/** Drag state */
export type DragState = {
  active: number;
  x: number;
  y: number;
  action: Actions;
  startX: number;
  startY: number;
};

/** Editing state */
export type EditingState = {
  character: EntityData | null;
  animation: Animation | null;
  keyframe: number;
  bubble: number;
};

/** Camera state */
export type CameraState = {
  x: number;
  y: number;
  scale: number;
};

/** Keyboard direction flags */
export type DirectionFlags = {
  up: number;
  left: number;
  down: number;
  right: number;
};
