/**
 * Type definitions for the animator module
 */

import type {
  HurtbubbleModelTransformData,
  HurtbubbleModelTranslationData,
} from './operations/model-transforms';

/**
 * Generic type for dynamic/unknown properties
 * Used when objects have runtime properties that cannot be statically typed
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional escape hatch for legacy dynamic properties
export type Generic = any;

/** A 3D model attached to a bone (mirrors `PrefabData.models[]`). */
export type BoneModel = {
  name: string;
  alias?: string;
  [prop: string]: Generic;
};

/** Character hurtbubble bone definition (mirrors engine `HBData`). */
export type HurtbubbleData = {
  name: string;
  i1: number;
  i2: number;
  z: number;
  ik?: number | boolean;
  /** Bone mirrors across the body centre when the character turns. */
  flip?: boolean;
  /** Model orientation is inverted for this bone. */
  invert?: boolean;
  /** Bone cannot be grabbed. */
  ungrabbable?: boolean;
  /** 3D prefab whose models follow this bone. */
  prefab?: { models?: BoneModel[] };
  /** Model orientation follows the bone capsule unless disabled. */
  rotateModel?: boolean;
  /** Static/default visual transform for the bone's attached model. */
  modelTransform?: HurtbubbleModelTransformData;
  modelTranslation?: HurtbubbleModelTranslationData;
  modelOffset?: HurtbubbleModelTranslationData;
  modelRotation?: number;
  [prop: string]: Generic;
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
  /** Per-bone attached-model x/y/rotation transforms; true continues previous. */
  hurtbubbleModelTransforms?: true | Generic;
  /** Tween the pose from this keyframe toward the next using `tween`. */
  interpolate?: boolean;
  /** Named easing function from the Ease table. */
  tween?: string;
  // Legacy: dynamic per-keyframe author properties (handler hooks, flags, …)
  [property: string]: Generic;
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

/** Camera state */
export type CameraState = {
  x: number;
  y: number;
  scale: number;
};
