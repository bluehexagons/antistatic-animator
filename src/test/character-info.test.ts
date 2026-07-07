import { describe, it, expect } from 'vitest';
import {
  namedBubbleAliases,
  bubbleLabels,
  boneModelLabel,
} from '../animator/rendering/character-info';
import type { EntityData } from '../animator/types';

// Mirrors the shape of carbon.json (6 bones, head/core aliases).
const character: EntityData = {
  name: 'carbon',
  headbubble: 3,
  corebubble: 2,
  hurtbubbles: [
    {
      name: 'rfoot',
      i1: 1,
      i2: 0,
      z: 4,
      prefab: { models: [{ name: 'CarbonFootGem', alias: 'side1' }, { name: 'CarbonFootMid' }] },
    },
    { name: 'rleg', i1: 0, i2: 2, z: 4 },
    { name: 'body', i1: 2, i2: 2, z: 0 },
    { name: 'head', i1: 3, i2: 3, z: 0 },
    { name: 'lleg', i1: 4, i2: 2, z: -4 },
    { name: 'lfoot', i1: 5, i2: 4, z: -4 },
  ],
};

describe('namedBubbleAliases', () => {
  it('maps alias bubble indices back to stripped names', () => {
    const aliases = namedBubbleAliases(character);
    expect(aliases.get(3)).toEqual(['head']);
    expect(aliases.get(2)).toEqual(['core']);
  });

  it('ignores non-numeric and non-bubble keys', () => {
    const aliases = namedBubbleAliases(character);
    expect(aliases.has(NaN)).toBe(false);
    // "name" is not a *bubble key
    expect([...aliases.values()].flat()).not.toContain('name');
  });
});

describe('bubbleLabels', () => {
  it('prefers named-bubble aliases over derived bone names', () => {
    const labels = bubbleLabels(character);
    expect(labels.get(3)).toBe('head');
    expect(labels.get(2)).toBe('core');
  });

  it('labels bone endpoints with i2 suffix', () => {
    const labels = bubbleLabels(character);
    // index 1 is rfoot.i1, index 5 is lfoot.i1
    expect(labels.get(1)).toBe('rfoot');
    expect(labels.get(5)).toBe('lfoot');
    // index 4 is lleg.i1 — first writer wins (lleg before lfoot.i2)
    expect(labels.get(4)).toBe('lleg');
  });
});

describe('boneModelLabel', () => {
  it('joins prefab model names', () => {
    expect(boneModelLabel(character.hurtbubbles[0])).toBe('CarbonFootGem, CarbonFootMid');
  });

  it('returns null when no prefab models', () => {
    expect(boneModelLabel(character.hurtbubbles[1])).toBeNull();
  });
});

import { mirrorName, mirrorBubblePermutation } from '../animator/rendering/character-info';

describe('mirrorName', () => {
  it('swaps left/right for right/left tokens', () => {
    expect(mirrorName('rightfoot')).toBe('leftfoot');
    expect(mirrorName('leftfoot')).toBe('rightfoot');
    expect(mirrorName('Rfoot')).toBe('Lfoot');
    expect(mirrorName('Lfoot')).toBe('Rfoot');
  });

  it('swaps single-letter side prefixes', () => {
    expect(mirrorName('rLeg')).toBe('lLeg');
    expect(mirrorName('lLeg')).toBe('rLeg');
  });

  it('returns unchanged when no side token', () => {
    expect(mirrorName('head')).toBe('head');
    expect(mirrorName('shoulder')).toBe('shoulder');
  });
});

describe('mirrorBubblePermutation', () => {
  it('swaps left/right bone indices', () => {
    const char: EntityData = {
      name: 'test',
      hurtbubbles: [
        { name: 'larm', i1: 0, i2: 0, z: 0 },
        { name: 'rarm', i1: 1, i2: 1, z: 0 },
        { name: 'lleg', i1: 2, i2: 2, z: 0 },
        { name: 'rleg', i1: 3, i2: 3, z: 0 },
      ],
    };
    const perm = mirrorBubblePermutation(char);
    expect(perm[0]).toBe(1);
    expect(perm[1]).toBe(0);
    expect(perm[2]).toBe(3);
    expect(perm[3]).toBe(2);
  });

  it('leaves unpaired middle bone unchanged (prevents mutation)', () => {
    const char: EntityData = {
      name: 'test',
      hurtbubbles: [
        { name: 'body', i1: 2, i2: 2, z: 0 },
        { name: 'core', i1: 2, i2: 2, z: 0 }, // duplicate i1
      ],
    };
    const perm = mirrorBubblePermutation(char);
    expect(perm[2]).toBe(2);
  });
});
