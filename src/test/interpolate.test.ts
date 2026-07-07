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
  it('returns the keyframe pose when interpolate is unset', () => {
    const anim = animationWithInterpolate(false);
    const pose = interpolatedPose(anim, 0, 5);
    expect(pose).toBe(anim.keyframes[0].hurtbubbles);
  });

  it('returns the keyframe pose when tick is 0', () => {
    const anim = animationWithInterpolate(true);
    const pose = interpolatedPose(anim, 0, 0);
    expect(pose).toBe(anim.keyframes[0].hurtbubbles);
  });

  it('lerps x/y/r at the midpoint with linear easing', () => {
    const anim = animationWithInterpolate(true);
    const pose = interpolatedPose(anim, 0, 5)!;
    expect(pose[0]).toBeCloseTo(5);
    expect(pose[1]).toBeCloseTo(10);
    expect(pose[2]).toBeCloseTo(3);
    expect(pose[3]).toBe(1); // state stays discrete
    expect(pose[4]).toBeCloseTo(10);
    expect(pose[5]).toBeCloseTo(15);
    expect(pose[6]).toBeCloseTo(3.5);
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
});
