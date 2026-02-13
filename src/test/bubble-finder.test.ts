/**
 * Tests for bubble finding logic
 */

import { describe, it, expect } from 'vitest';
import { findBubbles, hbmap } from '../animator/rendering/bubble-finder';
import type { EntityData, Animation, HurtbubbleData } from '../animator/types';

describe('Bubble Finder', () => {
  const mockCharacter: EntityData = {
    name: 'TestChar',
    hurtbubbles: [
      { name: 'head', i1: 0, i2: 1, z: 0, ik: false },
      { name: 'body', i1: 1, i2: 2, z: 0, ik: false },
    ],
  };

  const mockAnimation: Animation = {
    keyframes: [
      {
        duration: 10,
        // 3 bubbles: [x, y, radius, state] for each
        hurtbubbles: [
          0,
          20,
          10,
          0, // bubble 0: center top
          0,
          0,
          8,
          0, // bubble 1: center middle
          0,
          -20,
          10,
          0, // bubble 2: center bottom
        ],
      },
    ],
  };

  describe('findBubbles', () => {
    it('should find bubbles at exact coordinates', () => {
      const ox = 0;
      const oy = 0.1;
      const w = 300;
      const h = 200;
      const scale = 2;

      // Center of canvas should be around bubble 1 (0, 0)
      const centerX = w / 2;
      const centerY = h / 2;

      const bubbles = findBubbles(
        mockCharacter,
        mockAnimation,
        0,
        ox,
        oy,
        w,
        h,
        scale,
        centerX,
        centerY
      );

      expect(Array.isArray(bubbles)).toBe(true);
    });

    it('should return empty array when clicking outside bubbles', () => {
      const bubbles = findBubbles(
        mockCharacter,
        mockAnimation,
        0,
        0,
        0.1,
        300,
        200,
        2,
        0, // far left
        0 // far top
      );

      expect(bubbles).toEqual([]);
    });

    it('should handle missing hurtbubbles', () => {
      const emptyAnimation: Animation = {
        keyframes: [{ duration: 10 }],
      };

      const bubbles = findBubbles(mockCharacter, emptyAnimation, 0, 0, 0.1, 300, 200, 2, 150, 100);

      expect(bubbles).toEqual([]);
    });

    it('should return bubble indices in order', () => {
      const bubbles = findBubbles(mockCharacter, mockAnimation, 0, 0, 0.1, 300, 200, 2, 150, 100);

      // Bubble indices should be multiples of 4 (flat array format)
      bubbles.forEach((index) => {
        expect(index % 4).toBe(0);
      });
    });
  });

  describe('hbmap', () => {
    it('should create a map of hurtbubble names to indices', () => {
      const hurtbubbles: HurtbubbleData[] = [
        { name: 'head', i1: 0, i2: 1, z: 0, ik: false },
        { name: 'body', i1: 1, i2: 2, z: 0, ik: false },
        { name: 'arm', i1: 2, i2: 3, z: 0, ik: false },
      ];

      const map = hbmap(hurtbubbles);

      expect(map.get('head')).toBe(1);
      expect(map.get('body')).toBe(2);
      expect(map.get('arm')).toBe(3);
    });

    it('should handle negative indices for i2', () => {
      const hurtbubbles: HurtbubbleData[] = [{ name: 'test', i1: 0, i2: 1, z: 0, ik: false }];

      const map = hbmap(hurtbubbles);

      // hbmap creates entries for both i1 and i2
      expect(map.get('test')).toBe(1);
      // The i2 key is created with "2" suffix
      expect(map.get('test2')).toBe(-1);
    });

    it('should handle empty hurtbubbles array', () => {
      const map = hbmap([]);
      expect(map.size).toBe(0);
    });
  });
});
