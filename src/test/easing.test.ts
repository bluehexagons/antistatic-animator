import { describe, expect, it } from 'vitest';
import { easings } from '@bluehexagons/easing/named';

import { TweenNames } from '../animator/schema';
import { Ease, easeFn } from '../easing';

describe('easing parity', () => {
  it('uses every named curve from the engine package', () => {
    expect(TweenNames).toEqual(Object.keys(easings));
    expect(easeFn('quadIn')).toBe(easings.quadIn);
    expect(easeFn('spring')).toBe(Ease.linear);
    expect(easeFn('unknown')).toBe(Ease.linear);
  });

  it('keeps elastic in-out centered and symmetric', () => {
    expect(Ease.elasticInOut(0.5)).toBe(0.5);
    for (const time of [0.1, 0.25, 0.4]) {
      expect(Ease.elasticInOut(time)).toBeCloseTo(1 - Ease.elasticInOut(1 - time), 12);
    }
  });

  it('rejects invalid elastic parameters', () => {
    expect(() => Ease.elasticIn(0.5, 0.5)).toThrow(RangeError);
    expect(() => Ease.elasticIn(0, 0.5)).toThrow(RangeError);
    expect(() => Ease.elasticOut(0.5, 1, 0)).toThrow(RangeError);
  });
});
