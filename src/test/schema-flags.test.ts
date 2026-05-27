import { describe, it, expect } from 'vitest';
import { packFlags, unpackFlags, flagsToNames, HitbubbleFlags } from '../animator/schema';

describe('hitbubble flag helpers', () => {
  it('packFlags/unpackFlags round-trip', () => {
    const names = ['meteor', 'no_reverse'];
    const bits = packFlags(names);
    expect(unpackFlags(bits).sort()).toEqual([...names].sort());
  });

  it('packFlags ignores unknown names', () => {
    expect(packFlags(['nonsense'])).toBe(0);
  });

  describe('flagsToNames reads every authored form', () => {
    it('numeric bitmask', () => {
      const bits = packFlags(['stale_di']);
      expect(flagsToNames(bits)).toEqual(['stale_di']);
    });
    it('single string', () => {
      expect(flagsToNames('stale_di')).toEqual(['stale_di']);
      expect(flagsToNames('')).toEqual([]);
    });
    it('string array, preserving unknown names', () => {
      expect(flagsToNames(['no_reverse', 'custom_flag'])).toEqual(['no_reverse', 'custom_flag']);
    });
    it('missing / wrong types', () => {
      expect(flagsToNames(undefined)).toEqual([]);
      expect(flagsToNames(null)).toEqual([]);
      expect(flagsToNames({})).toEqual([]);
    });
  });

  it('every flag bit is distinct', () => {
    const bits = HitbubbleFlags.map((f) => f.bit);
    expect(new Set(bits).size).toBe(bits.length);
  });
});
