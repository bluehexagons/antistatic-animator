import * as JSONC from 'jsonc-parser';
import type { AnimationMap, EntityData } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseErrorMessage = (error: JSONC.ParseError): string =>
  JSONC.printParseErrorCode(error.error);

/** Parse JSONC without accepting the partial values returned for malformed input. */
export const parseJsoncValue = <T = unknown>(source: string, label = 'JSONC document'): T => {
  const parseErrors: JSONC.ParseError[] = [];
  let value: unknown;
  try {
    value = JSONC.parse(source, parseErrors);
  } catch (error) {
    throw new Error(`Unable to parse ${label}: ${(error as Error).message ?? String(error)}`);
  }
  if (parseErrors.length > 0) {
    const details = parseErrors.map(parseErrorMessage).join(', ');
    throw new Error(`Unable to parse ${label}: ${details}`);
  }
  return value as T;
};

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object`);
  return value;
};

/** Parse the minimum character shape required by the animator and renderer. */
export const parseCharacterDocument = (source: string): EntityData => {
  const value = requireRecord(parseJsoncValue(source, 'character file'), 'Character file');
  if (typeof value.name !== 'string' || value.name.trim() === '') {
    throw new Error('Character file must have a non-empty name');
  }
  if (!Array.isArray(value.hurtbubbles)) {
    throw new Error('Character file must have a hurtbubbles array');
  }
  for (let index = 0; index < value.hurtbubbles.length; index++) {
    const bone = value.hurtbubbles[index];
    if (!isRecord(bone) || typeof bone.name !== 'string' || bone.name.trim() === '') {
      throw new Error(`Character hurtbubbles[${index}] must have a name`);
    }
    if (
      !Number.isInteger(bone.i1) ||
      !Number.isInteger(bone.i2) ||
      (bone.i1 as number) < 0 ||
      (bone.i2 as number) < 0
    ) {
      throw new Error(`Character hurtbubbles[${index}] must have integer endpoint indices`);
    }
    if (typeof bone.z !== 'number' || !Number.isFinite(bone.z)) {
      throw new Error(`Character hurtbubbles[${index}] must have a finite z coordinate`);
    }
  }
  return value as EntityData;
};

/** Parse an animation map and reject malformed entries before they reach the editor. */
export const parseAnimationDocument = (source: string): AnimationMap => {
  const value = requireRecord(parseJsoncValue(source, 'animation file'), 'Animation file');
  for (const [name, animation] of Object.entries(value)) {
    if (!isRecord(animation) || !Array.isArray(animation.keyframes)) {
      throw new Error(`Animation "${name}" must have a keyframes array`);
    }
    for (let index = 0; index < animation.keyframes.length; index++) {
      const keyframe = animation.keyframes[index];
      if (
        !isRecord(keyframe) ||
        typeof keyframe.duration !== 'number' ||
        !Number.isFinite(keyframe.duration)
      ) {
        throw new Error(`Animation "${name}" keyframe ${index} must have a numeric duration`);
      }
    }
  }
  return value as AnimationMap;
};
