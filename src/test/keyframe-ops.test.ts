/**
 * Tests for keyframe operations
 */

import { describe, it, expect } from 'vitest';
import {
  cloneHurtbubbles,
  cloneKeyframe,
  resolveHitbubbles,
} from '../animator/operations/keyframe-ops';
import type { Keyframe, Animation } from '../animator/types';

describe('Keyframe Operations', () => {
  describe('cloneHurtbubbles', () => {
    it('should clone a hurtbubbles array', () => {
      const original = [0, 10, 5, 0, 0, 0, 5, 0, 0, -10, 5, 0];
      const cloned = cloneHurtbubbles(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original); // Different reference
    });

    it('should handle empty array', () => {
      const cloned = cloneHurtbubbles([]);
      expect(cloned).toEqual([]);
    });

    it('should create independent copy', () => {
      const original = [1, 2, 3, 4];
      const cloned = cloneHurtbubbles(original);

      cloned[0] = 999;
      expect(original[0]).toBe(1);
      expect(cloned[0]).toBe(999);
    });
  });

  describe('cloneKeyframe', () => {
    it('should clone a simple keyframe', () => {
      const original: Keyframe = {
        duration: 10,
        hurtbubbles: [0, 10, 5, 0],
      };

      const cloned = cloneKeyframe(original);

      expect(cloned.duration).toBe(original.duration);
      expect(cloned.hurtbubbles).toEqual(original.hurtbubbles);
      expect(cloned.hurtbubbles).not.toBe(original.hurtbubbles);
    });

    it('should clone keyframe with hitbubbles', () => {
      const original: Keyframe = {
        duration: 10,
        hurtbubbles: [0, 10, 5, 0],
        hitbubbles: [{ x: 5, y: 10, radius: 8 }],
      };

      const cloned = cloneKeyframe(original);

      expect(cloned.hitbubbles).toBeDefined();
      expect(Array.isArray(cloned.hitbubbles)).toBe(true);
      if (Array.isArray(cloned.hitbubbles)) {
        expect(cloned.hitbubbles[0]).toEqual({ x: 5, y: 10, radius: 8 });
        expect(cloned.hitbubbles).not.toBe(original.hitbubbles);
      }
    });

    it('should handle keyframe with hitbubbles reference (true)', () => {
      const original: Keyframe = {
        duration: 10,
        hurtbubbles: [0, 10, 5, 0],
        hitbubbles: true,
      };

      const cloned = cloneKeyframe(original);

      expect(cloned.hitbubbles).toBe(true);
    });

    it('should clone additional properties', () => {
      const original: Keyframe & { tween: string; customProp: string } = {
        duration: 10,
        hurtbubbles: [0, 10, 5, 0],
        tween: 'easeInOut',
        customProp: 'test',
      };

      const cloned = cloneKeyframe(original);

      expect((cloned as typeof original).tween).toBe('easeInOut');
      expect((cloned as typeof original).customProp).toBe('test');
    });
  });

  describe('resolveHitbubbles', () => {
    const mockAnimation: Animation = {
      keyframes: [
        { duration: 10, hurtbubbles: [0, 0, 5, 0], hitbubbles: [{ x: 0, y: 0, radius: 10 }] },
        { duration: 10, hurtbubbles: [0, 5, 5, 0], hitbubbles: true },
        { duration: 10, hurtbubbles: [0, 10, 5, 0], hitbubbles: true },
        { duration: 10, hurtbubbles: [0, 15, 5, 0] },
      ],
    };

    it('should return hitbubbles array when present', () => {
      const result = resolveHitbubbles(mockAnimation, 0);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([{ x: 0, y: 0, radius: 10 }]);
    });

    it('should resolve hitbubbles reference to previous keyframe', () => {
      const result = resolveHitbubbles(mockAnimation, 1);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([{ x: 0, y: 0, radius: 10 }]);
    });

    it('should resolve chained hitbubbles references', () => {
      const result = resolveHitbubbles(mockAnimation, 2);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([{ x: 0, y: 0, radius: 10 }]);
    });

    it('should return null when no hitbubbles present', () => {
      const result = resolveHitbubbles(mockAnimation, 3);
      expect(result).toBeNull();
    });

    it('should handle invalid keyframe index', () => {
      const result = resolveHitbubbles(mockAnimation, 999);
      expect(result).toBeNull();
    });

    it('should handle negative keyframe index', () => {
      const result = resolveHitbubbles(mockAnimation, -1);
      expect(result).toBeNull();
    });
  });
});
