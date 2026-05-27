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
