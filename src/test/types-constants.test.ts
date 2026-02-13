/**
 * Tests for constants and type safety
 */

import { describe, it, expect } from 'vitest';
import { multichoice, defaultTypes, excludeProps } from '../animator/constants';
import type { Keyframe, Animation, HurtbubbleData, Hitbubble } from '../animator/types';

describe('Constants', () => {
  describe('multichoice', () => {
    it('should contain tween configuration', () => {
      expect(multichoice).toHaveProperty('tween');
      expect(multichoice.tween).toHaveProperty('default');
      expect(multichoice.tween).toHaveProperty('choices');
    });

    it('should have valid tween choices', () => {
      expect(Array.isArray(multichoice.tween.choices)).toBe(true);
      expect(multichoice.tween.choices.length).toBeGreaterThan(0);
    });

    it('should have default tween value in choices', () => {
      const { default: defaultTween, choices } = multichoice.tween;
      expect(choices).toContain(defaultTween);
    });
  });

  describe('defaultTypes', () => {
    it('should map property names to types', () => {
      expect(defaultTypes.duration).toBe('number');
      expect(defaultTypes.tween).toBe('string');
      expect(defaultTypes.interpolate).toBe('bool');
    });

    it('should have valid type values', () => {
      const validTypes = ['string', 'number', 'bool', 'boolean'];
      Object.values(defaultTypes).forEach((type) => {
        expect(validTypes).toContain(type);
      });
    });
  });

  describe('excludeProps', () => {
    it('should be a Set', () => {
      expect(excludeProps instanceof Set).toBe(true);
    });

    it('should contain keyframes property', () => {
      expect(excludeProps.has('keyframes')).toBe(true);
    });

    it('should contain hurtbubbles property', () => {
      expect(excludeProps.has('hurtbubbles')).toBe(true);
    });
  });
});

describe('Type Definitions', () => {
  describe('Keyframe', () => {
    it('should accept valid keyframe with hurtbubbles', () => {
      const keyframe: Keyframe = {
        duration: 10,
        hurtbubbles: [0, 10, 5, 0, 0, 0, 5, 0],
      };

      expect(keyframe.duration).toBe(10);
      expect(Array.isArray(keyframe.hurtbubbles)).toBe(true);
    });

    it('should accept keyframe with hitbubbles array', () => {
      const keyframe: Keyframe = {
        duration: 10,
        hurtbubbles: [0, 10, 5, 0],
        hitbubbles: [{ x: 5, y: 10, radius: 8 }],
      };

      expect(Array.isArray(keyframe.hitbubbles)).toBe(true);
    });

    it('should accept keyframe with hitbubbles reference', () => {
      const keyframe: Keyframe = {
        duration: 10,
        hurtbubbles: [0, 10, 5, 0],
        hitbubbles: true,
      };

      expect(keyframe.hitbubbles).toBe(true);
    });

    it('should accept keyframe with additional properties', () => {
      const keyframe: Keyframe = {
        duration: 10,
        hurtbubbles: [0, 10, 5, 0],
        tween: 'easeInOut',
        interpolate: true,
      };

      expect(keyframe.tween).toBe('easeInOut');
      expect(keyframe.interpolate).toBe(true);
    });
  });

  describe('Animation', () => {
    it('should accept valid animation', () => {
      const animation: Animation = {
        keyframes: [
          { duration: 10, hurtbubbles: [0, 10, 5, 0] },
          { duration: 10, hurtbubbles: [0, 10, 5, 0] },
        ],
      };

      expect(Array.isArray(animation.keyframes)).toBe(true);
      expect(animation.keyframes.length).toBe(2);
    });

    it('should accept animation with additional properties', () => {
      const animation: Animation = {
        keyframes: [{ duration: 10, hurtbubbles: [0, 10, 5, 0] }],
        iasa: 15,
        cancellable: 'jump',
      };

      expect(animation.iasa).toBe(15);
      expect(animation.cancellable).toBe('jump');
    });
  });

  describe('HurtbubbleData', () => {
    it('should accept valid hurtbubble data', () => {
      const hurtbubble: HurtbubbleData = {
        name: 'head',
        i1: 0,
        i2: 1,
        z: 0,
        ik: false,
      };

      expect(hurtbubble.name).toBe('head');
      expect(hurtbubble.i1).toBe(0);
      expect(hurtbubble.i2).toBe(1);
    });
  });

  describe('Hitbubble', () => {
    it('should accept hitbubble with position and radius', () => {
      const hitbubble: Hitbubble = {
        x: 10,
        y: 20,
        radius: 8,
      };

      expect(hitbubble.x).toBe(10);
      expect(hitbubble.y).toBe(20);
      expect(hitbubble.radius).toBe(8);
    });

    it('should accept hitbubble with follow property', () => {
      const hitbubble: Hitbubble = {
        x: 5,
        y: 5,
        radius: 8,
        follow: 'head',
      };

      expect(hitbubble.follow).toBe('head');
    });

    it('should accept hitbubble with type property', () => {
      const hitbubble: Hitbubble = {
        x: 10,
        y: 10,
        radius: 8,
        type: 'strong',
      };

      expect(hitbubble.type).toBe('strong');
    });

    it('should accept hitbubble with additional properties', () => {
      const hitbubble: Hitbubble = {
        x: 10,
        y: 10,
        radius: 8,
        damage: 15,
        knockback: 5,
      };

      expect(hitbubble.damage).toBe(15);
      expect(hitbubble.knockback).toBe(5);
    });
  });
});
