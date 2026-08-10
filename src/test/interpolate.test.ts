/**
 * Tests for pose interpolation between keyframes.
 */

import { describe, it, expect } from 'vitest';
import { interpolatedPose } from '../animator/operations/interpolate';
import type { Animation } from '../animator/types';

const animationWithInterpolate = (interpolate: boolean, tween?: string): Animation => ({
  type: 'movement',
  keyframes: [
    { duration: 10, interpolate, tween, hurtbubbles: [0, 0, 1, 1, 0, 0, 1, 1] },
    { duration: 10, hurtbubbles: [10, 20, 5, 1, 20, 30, 6, 1] },
  ],
});

describe('interpolatedPose', () => {
  it('matches engine interpolation when interpolate is unset', () => {
    const anim = animationWithInterpolate(false);
    const pose = interpolatedPose(anim, 0, 5)!;
    expect(pose[0]).toBeCloseTo(10 * (6 / 11));
  });

  it('uses the engine first-sample offset at tick 0', () => {
    const anim = animationWithInterpolate(true);
    const pose = interpolatedPose(anim, 0, 0)!;
    expect(pose[0]).toBeCloseTo(10 / 11);
  });

  it('lerps x/y/r at the midpoint with linear easing', () => {
    const anim = animationWithInterpolate(true);
    const pose = interpolatedPose(anim, 0, 5)!;
    expect(pose[0]).toBeCloseTo(10 * (6 / 11));
    expect(pose[1]).toBeCloseTo(20 * (6 / 11));
    expect(pose[2]).toBeCloseTo(1 + 4 * (6 / 11));
    expect(pose[3]).toBe(1); // state stays discrete
    expect(pose[4]).toBeCloseTo(20 * (6 / 11));
    expect(pose[5]).toBeCloseTo(30 * (6 / 11));
    expect(pose[6]).toBeCloseTo(1 + 5 * (6 / 11));
  });

  it('respects the next keyframe pose at tick == duration', () => {
    const anim = animationWithInterpolate(true);
    const pose = interpolatedPose(anim, 0, 10)!;
    expect(pose[0]).toBeCloseTo(10);
    expect(pose[1]).toBeCloseTo(20);
    expect(pose[2]).toBeCloseTo(5);
  });

  it('falls back to the keyframe pose if there is no next keyframe', () => {
    const anim: Animation = {
      type: 'movement',
      keyframes: [{ duration: 10, interpolate: true, hurtbubbles: [0, 0, 1, 1] }],
    };
    const pose = interpolatedPose(anim, 0, 5);
    expect(pose).toBe(anim.keyframes[0].hurtbubbles);
  });

  it('skips interpolation when hurtbubble lengths differ between keyframes', () => {
    const anim: Animation = {
      type: 'movement',
      keyframes: [
        { duration: 10, interpolate: true, hurtbubbles: [0, 0, 1, 1] },
        { duration: 10, hurtbubbles: [10, 20, 5, 1, 15, 25, 6, 1] },
      ],
    };
    const pose = interpolatedPose(anim, 0, 5);
    expect(pose).toBe(anim.keyframes[0].hurtbubbles);
    expect(pose?.length).toBe(4);
  });

  it('holds omitted poses and uses the terminal keyframe as the destination', () => {
    const anim: Animation = {
      keyframes: [
        { duration: 2, hurtbubbles: [0, 0, 1, 1] },
        { duration: 3 },
        { duration: 1, hurtbubbles: [10, 0, 1, 1] },
      ],
    };
    expect(interpolatedPose(anim, 1, 0)?.[0]).toBeCloseTo(5);
    expect(interpolatedPose(anim, 2, 0)).toBe(anim.keyframes[2].hurtbubbles);
  });

  it('uses the previous runtime pose for an interpolated keyframe', () => {
    const anim: Animation = {
      keyframes: [
        { duration: 10, hurtbubbles: [0, 0, 1, 1] },
        { duration: 10, interpolate: true, hurtbubbles: [10, 0, 1, 1] },
        { duration: 1, hurtbubbles: [20, 0, 1, 1] },
      ],
    };
    const previousEnd = 10 * (10 / 11);
    expect(interpolatedPose(anim, 1, 0)?.[0]).toBeCloseTo(previousEnd + (20 - previousEnd) / 11);
  });
});
