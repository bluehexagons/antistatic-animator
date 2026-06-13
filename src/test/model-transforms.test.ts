import { describe, expect, it } from 'vitest';
import type { Animation, EntityData } from '../animator/types';
import {
  createAuthoredHurtbubbleModelTransformDefaults,
  normalizeHurtbubbleModelTransforms,
  tweenHurtbubbleModelTransforms,
} from '../animator/operations/model-transforms';
import {
  authoredModelTransformFrame,
  interpolatedModelTransformFrame,
  modelTransformFrameToAuthorObject,
} from '../animator/operations/model-transform-timeline';

const character: EntityData = {
  name: 'test',
  hurtbubbles: [
    {
      name: 'rhand',
      i1: 0,
      i2: 0,
      z: 1,
      prefab: { models: [{ name: 'Hand' }] },
      modelTranslation: [1, 2],
    },
    { name: 'lhand', i1: 1, i2: 1, z: -1, prefab: { models: [{ name: 'Hand' }] } },
  ],
};

describe('model transform parsing', () => {
  it('reads character defaults with engine y-flip semantics', () => {
    expect(createAuthoredHurtbubbleModelTransformDefaults(character.hurtbubbles)).toEqual([
      1, -2, 0, 0, 0, 0,
    ]);
  });

  it('normalizes object and flat frame forms', () => {
    const defaults = [0, 0, 0, 0, 0, 0];
    const resolver = (key: string) => (key === 'rhand' ? 1 : undefined);
    expect(
      normalizeHurtbubbleModelTransforms(
        { rhand: { x: 2, y: 3, rotation: 15 }, 1: [4, 5, 30] },
        2,
        defaults,
        resolver
      )
    ).toEqual([2, -3, 15, 4, -5, 30]);
    expect(normalizeHurtbubbleModelTransforms([1, 2, 3, 4, 5, 6], 2, defaults)).toEqual([
      1, -2, 3, 4, -5, 6,
    ]);
  });

  it('tweens rotation across the shortest angular path', () => {
    expect(tweenHurtbubbleModelTransforms([0, 0, 170], [0, 0, -170], 0.5)[2]).toBe(180);
  });

  it('serializes normalized frames back to author-space objects', () => {
    expect(modelTransformFrameToAuthorObject([2, -3, 15, 4, -5, 30], character)).toEqual({
      rhand: { x: 2, y: 3, rotation: 15 },
      lhand: { x: 4, y: 5, rotation: 30 },
    });
  });
});

describe('model transform timeline', () => {
  it('resolves continuation frames from previous anchors', () => {
    const animation: Animation = {
      keyframes: [
        { duration: 4, hurtbubbleModelTransforms: { rhand: { x: 2, y: 3, rotation: 15 } } },
        { duration: 4, hurtbubbleModelTransforms: true },
      ],
    };
    expect(authoredModelTransformFrame(animation, character, 1)).toEqual([2, -3, 15, 0, 0, 0]);
  });

  it('interpolates through omitted keyframes like the engine prepare step', () => {
    const animation: Animation = {
      keyframes: [
        { duration: 10, hurtbubbleModelTransforms: { rhand: { rotation: 170 } } },
        { duration: 10 },
        { duration: 10, hurtbubbleModelTransforms: { rhand: { rotation: -170 } } },
      ],
    };
    const frame = interpolatedModelTransformFrame(animation, character, 1, 0)!;
    expect(frame[2]).toBe(180);
  });
});
