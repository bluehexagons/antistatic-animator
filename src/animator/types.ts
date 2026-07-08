/**
 * Type definitions for the animator module
 */

import type {
  HurtbubbleModelTransformData,
  HurtbubbleModelTranslationData,
} from './operations/model-transforms';

/** A 3D model attached to a bone (mirrors `PrefabData.models[]`). */
export type BoneModel = {
  name: string;
  alias?: string;
  [prop: string]: unknown;
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
  [prop: string]: unknown;
};

/** Attack hitbox definition — known engine fields typed, dynamic fields fall through to `unknown`. */
export type Hitbubble = {
  x?: number;
  y?: number;
  radius?: number;
  follow?: string;
  type?: string;
  damage?: number;
  knockback?: number;
  growth?: number;
  angle?: number;
  sakurai?: boolean;
  strong?: boolean;
  /** Flags can be a bitmask, a name string, or an array of name strings. */
  flags?: string[] | number | string;
  /** Smear trail anchor and offset. */
  smear?: { x?: number; y?: number; follow?: string };
  /** Audio cue — plain name string or object with pitch/volume. */
  audio?: string | { name?: string; pitch?: number; volume?: number };
  x2?: number;
  y2?: number;
  start?: number;
  end?: number;
  [prop: string]: unknown;
};

/** Hurtbubble coordinate (stored as flat array of numbers) */
export type Hurtbubble = number;

/** Animation keyframe */
export type Keyframe = {
  duration: number;
  hitbubbles?: Hitbubble[] | true; // true = reference to previous keyframe
  hurtbubbles?: Hurtbubble[];
  /** Per-bone attached-model x/y/rotation transforms; true continues previous. */
  hurtbubbleModelTransforms?: true | unknown;
  /** Tween the pose from this keyframe toward the next using `tween`. */
  interpolate?: boolean;
  /** Named easing function from the Ease table. */
  tween?: string;
  // Legacy: dynamic per-keyframe author properties (handler hooks, flags, …)
  [property: string]: unknown;
};

/** Animation definition */
export type Animation = {
  keyframes: Keyframe[];
  type?: string;
  [property: string]: unknown;
};

/** Map of animation names to Animation objects */
export type AnimationMap = {
  [name: string]: Animation;
};

/** Character entity data */
export type EntityData = {
  name: string;
  hurtbubbles: HurtbubbleData[];
  shieldX?: number;
  shieldY?: number;
  shieldX2?: number;
  shieldY2?: number;
  shieldMinSize?: number;
  shieldGrowth?: number;
  [name: string]: unknown;
};

/** UI multichoice dropdown configuration */
export type Multichoices = {
  default: string;
  choices: string[];
};
