import { easeFn } from '../../easing';
import { objHas } from '../../utils';
import type { Animation, EntityData, HurtbubbleData, Keyframe } from '../types';
import {
  HURTBUBBLE_MODEL_TRANSFORM_FIELDS,
  createAuthoredHurtbubbleModelTransformDefaults,
  normalizeHurtbubbleModelTransforms,
  resolveHurtbubbleModelTransformIndex,
  tweenHurtbubbleModelTransforms,
} from './model-transforms';

export type ModelTransformObjectEntry = {
  x: number;
  y: number;
  rotation: number;
};

export type ModelTransformObject = Record<string, ModelTransformObjectEntry>;

export const keyframeHasModelTransforms = (keyframe: Keyframe | undefined): keyframe is Keyframe =>
  !!keyframe && objHas(keyframe, 'hurtbubbleModelTransforms');

export const modelTransformNameResolver = (character: EntityData) => (key: string) => {
  for (let i = 0; i < character.hurtbubbles.length; i++) {
    const name = character.hurtbubbles[i]?.name;
    if (!name) continue;
    if (key === name) return i + 1;
    if (key === `${name}2`) return -i - 1;
  }
  return undefined;
};

export const modelTransformDefaults = (character: EntityData) =>
  createAuthoredHurtbubbleModelTransformDefaults(character.hurtbubbles);

export const normalizeModelTransformData = (
  character: EntityData,
  data: unknown,
  defaults = modelTransformDefaults(character)
) =>
  normalizeHurtbubbleModelTransforms(
    data,
    character.hurtbubbles.length,
    defaults,
    modelTransformNameResolver(character)
  );

export const authoredModelTransformFrame = (
  animation: Animation,
  character: EntityData,
  keyframe: number,
  defaults = modelTransformDefaults(character)
): number[] | null => {
  const kf = animation.keyframes[keyframe];
  if (!keyframeHasModelTransforms(kf)) return null;

  if (kf.hurtbubbleModelTransforms === true) {
    for (let i = keyframe - 1; i >= 0; i--) {
      const prev = animation.keyframes[i];
      if (!keyframeHasModelTransforms(prev)) continue;
      if (prev.hurtbubbleModelTransforms !== true) {
        return normalizeModelTransformData(character, prev.hurtbubbleModelTransforms, defaults);
      }
    }
    return [...defaults];
  }

  return normalizeModelTransformData(character, kf.hurtbubbleModelTransforms, defaults);
};

const keyForBone = (bone: HurtbubbleData, index: number) => bone.name || String(index);

export const modelTransformFrameToAuthorObject = (
  frame: number[],
  character: EntityData
): ModelTransformObject => {
  const out: ModelTransformObject = {};
  for (let i = 0; i < character.hurtbubbles.length; i++) {
    const offset = i * HURTBUBBLE_MODEL_TRANSFORM_FIELDS;
    out[keyForBone(character.hurtbubbles[i], i)] = {
      x: frame[offset] ?? 0,
      y: -(frame[offset + 1] ?? 0),
      rotation: frame[offset + 2] ?? 0,
    };
  }
  return out;
};

export const ensureModelTransformObject = (
  animation: Animation,
  character: EntityData,
  keyframe: number
): ModelTransformObject => {
  const kf = animation.keyframes[keyframe];
  const defaults = modelTransformDefaults(character);
  if (!kf) return {};

  const current = kf.hurtbubbleModelTransforms;
  if (current && current !== true && typeof current === 'object' && !Array.isArray(current)) {
    return current as ModelTransformObject;
  }

  const frame = authoredModelTransformFrame(animation, character, keyframe, defaults) ?? defaults;
  const objectFrame = modelTransformFrameToAuthorObject(frame, character);
  kf.hurtbubbleModelTransforms = objectFrame;
  return objectFrame;
};

export const setModelTransformObjectValue = (
  animation: Animation,
  character: EntityData,
  keyframe: number,
  boneIndex: number,
  field: keyof ModelTransformObjectEntry,
  value: number
) => {
  const objectFrame = ensureModelTransformObject(animation, character, keyframe);
  const defaults = modelTransformDefaults(character);
  const frame = normalizeModelTransformData(character, objectFrame, defaults);
  const offset = boneIndex * HURTBUBBLE_MODEL_TRANSFORM_FIELDS;
  const key = keyForBone(character.hurtbubbles[boneIndex], boneIndex);
  const current = objectFrame[key];
  objectFrame[key] = {
    x: frame[offset] ?? 0,
    y: -(frame[offset + 1] ?? 0),
    rotation: frame[offset + 2] ?? 0,
    ...(current && typeof current === 'object' ? current : {}),
    [field]: value,
  };
};

export const interpolatedModelTransformFrame = (
  animation: Animation,
  character: EntityData,
  keyframe: number,
  tick: number
): number[] | null => {
  const keyframes = animation.keyframes;
  const current = keyframes[keyframe];
  if (!current) return null;

  let start = -1;
  for (let i = keyframe; i >= 0; i--) {
    if (keyframeHasModelTransforms(keyframes[i])) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  const defaults = modelTransformDefaults(character);
  const startFrame = authoredModelTransformFrame(animation, character, start, defaults) ?? defaults;
  let next = -1;
  for (let i = start + 1; i < keyframes.length; i++) {
    if (keyframeHasModelTransforms(keyframes[i])) {
      next = i;
      break;
    }
  }
  const nextFrame =
    next === -1
      ? defaults
      : (authoredModelTransformFrame(animation, character, next, defaults) ?? defaults);
  const end = next === -1 ? keyframes.length : next;

  let duration = 0;
  for (let i = start; i < end; i++) {
    duration += keyframes[i]?.duration ?? 0;
  }
  if (duration <= 0) return startFrame;

  let elapsed = Math.max(0, tick);
  for (let i = start; i < keyframe; i++) {
    elapsed += keyframes[i]?.duration ?? 0;
  }
  const t = Math.max(0, Math.min(1, elapsed / duration));
  const ease = easeFn(current.tween as string | undefined);
  return tweenHurtbubbleModelTransforms(startFrame, nextFrame, ease(t));
};

export const modelTransformUnknownKeys = (character: EntityData, data: unknown): string[] => {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return [];
  const resolver = modelTransformNameResolver(character);
  const out: string[] = [];
  for (const key of Object.getOwnPropertyNames(data)) {
    if (resolveHurtbubbleModelTransformIndex(key, character.hurtbubbles.length, resolver) === -1) {
      out.push(key);
    }
  }
  return out;
};
