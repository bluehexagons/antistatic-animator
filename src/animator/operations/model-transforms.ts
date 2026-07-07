// SPDX-License-Identifier: MIT

export const HURTBUBBLE_MODEL_TRANSFORM_FIELDS = 3;

export type HurtbubbleModelTranslationData = [number, number] | { x?: number; y?: number };

export type HurtbubbleModelTransformData =
  | number
  | [number, number]
  | [number, number, number]
  | {
      translation?: HurtbubbleModelTranslationData;
      translate?: HurtbubbleModelTranslationData;
      offset?: HurtbubbleModelTranslationData;
      position?: HurtbubbleModelTranslationData;
      x?: number;
      y?: number;
      rotation?: number;
      rotate?: number;
      angle?: number;
    };

export type HurtbubbleModelTransformDefaultsData = {
  modelTransform?: HurtbubbleModelTransformData;
  modelTranslation?: HurtbubbleModelTranslationData;
  modelOffset?: HurtbubbleModelTranslationData;
  modelRotation?: number;
};

type Vector2Like = {
  [index: number]: number;
};

export type HurtbubbleModelTransformDefaults = {
  defaultModelTranslation: Vector2Like;
  defaultModelRotation: number;
};

export type HurtbubbleModelTransformTarget = HurtbubbleModelTransformDefaults & {
  modelTranslation: Vector2Like;
  modelRotation: number;
};

export type HurtbubbleModelTransformNameResolver = (key: string) => number | undefined;

const hasOwn = (value: object, key: string | number) =>
  Object.prototype.hasOwnProperty.call(value, key);

const finiteOrZero = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export const writeHurtbubbleModelTranslation = (
  frame: number[],
  index: number,
  translation: HurtbubbleModelTranslationData,
  flipY: boolean
) => {
  const offset = index * HURTBUBBLE_MODEL_TRANSFORM_FIELDS;
  let x = Number.isFinite(frame[offset]) ? frame[offset] : 0;
  let y = Number.isFinite(frame[offset + 1]) ? frame[offset + 1] : 0;

  if (Array.isArray(translation)) {
    if (hasOwn(translation, 0)) {
      x = finiteOrZero(translation[0]);
    }
    if (hasOwn(translation, 1)) {
      const nextY = finiteOrZero(translation[1]);
      y = flipY ? -nextY : nextY;
    }
  } else if (translation !== null && typeof translation === 'object') {
    if (hasOwn(translation, 'x')) {
      x = finiteOrZero(translation.x);
    }
    if (hasOwn(translation, 'y')) {
      const nextY = finiteOrZero(translation.y);
      y = flipY ? -nextY : nextY;
    }
  }

  frame[offset] = x;
  frame[offset + 1] = y;
};

export const writeHurtbubbleModelTransform = (
  frame: number[],
  index: number,
  transform: HurtbubbleModelTransformData,
  flipY: boolean
) => {
  const offset = index * HURTBUBBLE_MODEL_TRANSFORM_FIELDS;

  if (typeof transform === 'number') {
    frame[offset + 2] = finiteOrZero(transform);
    return;
  }

  if (Array.isArray(transform)) {
    if (hasOwn(transform, 0)) {
      frame[offset] = finiteOrZero(transform[0]);
    }
    if (hasOwn(transform, 1)) {
      const y = finiteOrZero(transform[1]);
      frame[offset + 1] = flipY ? -y : y;
    }
    if (hasOwn(transform, 2)) {
      frame[offset + 2] = finiteOrZero(transform[2]);
    }
    return;
  }

  if (transform === null || typeof transform !== 'object') {
    return;
  }

  const translation =
    transform.translation || transform.translate || transform.offset || transform.position;
  if (translation) {
    writeHurtbubbleModelTranslation(frame, index, translation, flipY);
  }
  if (hasOwn(transform, 'x')) {
    frame[offset] = finiteOrZero(transform.x);
  }
  if (hasOwn(transform, 'y')) {
    const y = finiteOrZero(transform.y);
    frame[offset + 1] = flipY ? -y : y;
  }
  if (hasOwn(transform, 'rotation')) {
    frame[offset + 2] = finiteOrZero(transform.rotation);
  } else if (hasOwn(transform, 'rotate')) {
    frame[offset + 2] = finiteOrZero(transform.rotate);
  } else if (hasOwn(transform, 'angle')) {
    frame[offset + 2] = finiteOrZero(transform.angle);
  }
};

export const readHurtbubbleModelTransformDefault = (data: HurtbubbleModelTransformDefaultsData) => {
  const frame = [0, 0, 0];

  if (data.modelTransform !== undefined) {
    writeHurtbubbleModelTransform(frame, 0, data.modelTransform, true);
  }
  if (data.modelTranslation !== undefined) {
    writeHurtbubbleModelTranslation(frame, 0, data.modelTranslation, true);
  } else if (data.modelOffset !== undefined) {
    writeHurtbubbleModelTranslation(frame, 0, data.modelOffset, true);
  }
  if (hasOwn(data, 'modelRotation')) {
    frame[2] = finiteOrZero(data.modelRotation);
  }

  return frame;
};

export const createAuthoredHurtbubbleModelTransformDefaults = (
  bubbles: readonly HurtbubbleModelTransformDefaultsData[]
) => {
  const frame: number[] = [];
  for (let i = 0; i < bubbles.length; i++) {
    frame.push(...readHurtbubbleModelTransformDefault(bubbles[i]));
  }
  return frame;
};

export const resolveHurtbubbleModelTransformIndex = (
  key: string,
  bubbleCount: number,
  resolveName?: HurtbubbleModelTransformNameResolver
) => {
  const namedIndex = resolveName ? resolveName(key) : undefined;
  if (namedIndex !== undefined) {
    const index = Math.abs(namedIndex) - 1;
    return index >= 0 && index < bubbleCount ? index : -1;
  }

  const index = Number(key);
  if (Number.isInteger(index) && index >= 0 && index < bubbleCount) {
    return index;
  }

  return -1;
};

export const normalizeHurtbubbleModelTransforms = (
  data: unknown,
  bubbleCount: number,
  defaults: number[],
  resolveName?: HurtbubbleModelTransformNameResolver
) => {
  const frame = [...defaults];

  if (data === true || data === null || data === undefined) {
    return frame;
  }

  if (Array.isArray(data)) {
    let flatNumeric = true;
    for (let i = 0; i < data.length; i++) {
      if (typeof data[i] !== 'number') {
        flatNumeric = false;
        break;
      }
    }

    if (flatNumeric) {
      const l = Math.min(frame.length, data.length);
      for (let i = 0; i < l; i++) {
        const value = Number.isFinite(data[i]) ? data[i] : 0;
        frame[i] = i % HURTBUBBLE_MODEL_TRANSFORM_FIELDS === 1 ? -value : value;
      }
    } else {
      const l = Math.min(bubbleCount, data.length);
      for (let i = 0; i < l; i++) {
        if (data[i] !== null && data[i] !== undefined) {
          writeHurtbubbleModelTransform(frame, i, data[i] as HurtbubbleModelTransformData, true);
        }
      }
    }

    return frame;
  }

  if (data !== null && typeof data === 'object') {
    for (const key of Object.getOwnPropertyNames(data)) {
      const index = resolveHurtbubbleModelTransformIndex(key, bubbleCount, resolveName);
      if (index !== -1) {
        writeHurtbubbleModelTransform(
          frame,
          index,
          (data as Record<string, HurtbubbleModelTransformData>)[key],
          true
        );
      }
    }
  }

  return frame;
};

const lerp = (a: number, b: number, fraction: number) => (b - a) * fraction + a;

export const lerpAngleDegrees = (from: number, to: number, fraction: number) => {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return from + delta * fraction;
};

export const tweenHurtbubbleModelTransforms = (
  frame1: number[],
  frame2: number[],
  fraction: number
) => {
  const l = frame1.length;
  const between: number[] = [];
  for (let i = 0; i < l; i++) {
    between.push(
      i % HURTBUBBLE_MODEL_TRANSFORM_FIELDS === 2
        ? lerpAngleDegrees(frame1[i], frame2[i], fraction)
        : lerp(frame1[i], frame2[i], fraction)
    );
  }
  return between;
};
