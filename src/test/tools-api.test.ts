/**
 * Tests for Tools API
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTools } from '../animator/api/tools';
import type { AnimationMap, Animation } from '../animator/types';

describe('Tools API', () => {
  let mockParsed: AnimationMap;
  let mockAnimation: Animation;
  let tools: ReturnType<typeof createTools>;

  beforeEach(() => {
    mockParsed = {
      idle: {
        keyframes: [
          { duration: 10, hurtbubbles: [0, 10, 5, 0, 0, 0, 5, 0] },
          { duration: 10, hurtbubbles: [0, 10, 5, 0, 0, 0, 5, 0] },
        ],
      },
      attack: {
        keyframes: [
          {
            duration: 5,
            hurtbubbles: [0, 10, 5, 0, 0, 0, 5, 0],
            hitbubbles: [{ x: 10, y: 0, radius: 8 }],
          },
          { duration: 10, hurtbubbles: [0, 10, 5, 0, 0, 0, 5, 0], hitbubbles: true },
          { duration: 5, hurtbubbles: [0, 10, 5, 0, 0, 0, 5, 0] },
        ],
      },
    };

    mockAnimation = mockParsed.idle;

    tools = createTools(
      () => mockParsed,
      () => mockAnimation,
      () => 'test_anim.json'
    );
  });

  describe('iterateKeyframes', () => {
    it('should iterate all keyframes across all animations', () => {
      const keyframes = Array.from(tools.iterateKeyframes());

      // Should have 2 keyframes from idle + 3 from attack = 5 total
      expect(keyframes.length).toBe(5);
    });

    it('should yield keyframe objects', () => {
      const keyframes = Array.from(tools.iterateKeyframes());

      keyframes.forEach((kf) => {
        expect(kf).toHaveProperty('duration');
        expect(typeof kf.duration).toBe('number');
      });
    });

    it('should handle empty parsed data', () => {
      const emptyTools = createTools(
        () => null,
        () => null,
        () => ''
      );

      const keyframes = Array.from(emptyTools.iterateKeyframes());
      expect(keyframes.length).toBe(0);
    });
  });

  describe('iterateCurrentKeyframes', () => {
    it('should iterate keyframes of loaded animation only', () => {
      const keyframes = Array.from(tools.iterateCurrentKeyframes());

      // Should only have 2 keyframes from idle animation
      expect(keyframes.length).toBe(2);
    });

    it('should yield correct keyframes', () => {
      const keyframes = Array.from(tools.iterateCurrentKeyframes());

      expect(keyframes[0].duration).toBe(10);
      expect(keyframes[1].duration).toBe(10);
    });

    it('should handle no loaded animation', () => {
      const noAnimTools = createTools(
        () => mockParsed,
        () => null,
        () => ''
      );

      const keyframes = Array.from(noAnimTools.iterateCurrentKeyframes());
      expect(keyframes.length).toBe(0);
    });
  });

  describe('iterateAnimations', () => {
    it('should iterate all animations', () => {
      const animations = Array.from(tools.iterateAnimations());

      expect(animations.length).toBe(2);
    });

    it('should yield animation objects', () => {
      const animations = Array.from(tools.iterateAnimations());

      animations.forEach((anim) => {
        expect(anim).toHaveProperty('keyframes');
        expect(Array.isArray(anim.keyframes)).toBe(true);
      });
    });

    it('should handle empty parsed data', () => {
      const emptyTools = createTools(
        () => null,
        () => null,
        () => ''
      );

      const animations = Array.from(emptyTools.iterateAnimations());
      expect(animations.length).toBe(0);
    });
  });

  describe('insertBubble', () => {
    it('should insert a bubble at specified index', () => {
      const originalLength = mockParsed.idle.keyframes[0].hurtbubbles!.length;

      // Insert at index 1 (after first bubble)
      const insertions = Array.from(tools.insertBubble(1));

      // Should yield [keyframe, slice] pairs for modification
      expect(insertions.length).toBeGreaterThan(0);

      insertions.forEach(([kf, slice]) => {
        expect(kf).toHaveProperty('hurtbubbles');
        expect(Array.isArray(slice)).toBe(true);
        expect(slice.length).toBe(4); // [x, y, radius, state]
      });

      // Hurtbubbles array should be longer after insertion
      expect(mockParsed.idle.keyframes[0].hurtbubbles!.length).toBe(originalLength + 4);
    });

    it('should skip keyframes without hurtbubbles', () => {
      const kfWithoutHurtbubbles = { duration: 10 };
      mockParsed.test = { keyframes: [kfWithoutHurtbubbles] };

      const insertions = Array.from(tools.insertBubble(0));

      // Should not modify keyframes without hurtbubbles
      expect(kfWithoutHurtbubbles).not.toHaveProperty('hurtbubbles');
    });

    it('should handle invalid index', () => {
      const insertions = Array.from(tools.insertBubble(-1));
      expect(insertions.length).toBe(0);
    });
  });

  describe('deleteBubble', () => {
    it('should delete a bubble at specified index', () => {
      const originalLength = mockParsed.idle.keyframes[0].hurtbubbles!.length;

      tools.deleteBubble(0);

      // Should remove 4 elements (one bubble)
      expect(mockParsed.idle.keyframes[0].hurtbubbles!.length).toBe(originalLength - 4);
    });

    it('should skip keyframes without hurtbubbles', () => {
      const kfWithoutHurtbubbles = { duration: 10 };
      mockParsed.test = { keyframes: [kfWithoutHurtbubbles] };

      // Should not throw
      expect(() => tools.deleteBubble(0)).not.toThrow();
    });

    it('should handle invalid index', () => {
      const originalLength = mockParsed.idle.keyframes[0].hurtbubbles!.length;

      tools.deleteBubble(-1);

      // Should not modify anything
      expect(mockParsed.idle.keyframes[0].hurtbubbles!.length).toBe(originalLength);
    });
  });
});
