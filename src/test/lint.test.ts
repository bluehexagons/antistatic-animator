/**
 * Tests for the animation linter. Mirrors the kind of mistakes the
 * engine would silently downgrade (unknown handlers, bad follow refs,
 * mismatched bubble counts).
 */

import { describe, it, expect } from 'vitest';
import { lintAnimation } from '../animator/lint';
import type { Animation, EntityData } from '../animator/types';

const sampleCharacter = (): EntityData => ({
  name: 'Test',
  hurtbubbles: [
    { name: 'foot', i1: 0, i2: 1, z: 0, ik: false },
    { name: 'body', i1: 1, i2: 2, z: 0, ik: false },
    { name: 'head', i1: 2, i2: 3, z: 0, ik: false },
  ],
  // bubble count = max(i1,i2)+1 = 4, so flat array length should be 16
  headbubble: 3,
});

const animationWith = (overrides: Partial<Animation>): Animation => ({
  type: 'movement',
  keyframes: [{ duration: 5, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1, 0, 10, 1, 1, 0, 15, 1, 1] }],
  ...overrides,
});

describe('lintAnimation', () => {
  it('reports nothing on a clean animation', () => {
    const issues = lintAnimation(sampleCharacter(), animationWith({}));
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('flags wrong hurtbubble count', () => {
    const issues = lintAnimation(
      sampleCharacter(),
      animationWith({
        keyframes: [{ duration: 5, hurtbubbles: [0, 0, 1, 1] }],
      })
    );
    expect(issues.some((i) => i.severity === 'error' && /Hurtbubble array/.test(i.message))).toBe(
      true
    );
  });

  it('flags unknown animation type', () => {
    const issues = lintAnimation(sampleCharacter(), animationWith({ type: 'banana' as never }));
    expect(issues.some((i) => /Unknown animation type/.test(i.message))).toBe(true);
  });

  it('flags hitbubbles: true with no predecessor', () => {
    const issues = lintAnimation(
      sampleCharacter(),
      animationWith({
        keyframes: [
          {
            duration: 5,
            hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1, 0, 10, 1, 1, 0, 15, 1, 1],
            hitbubbles: true,
          },
        ],
      })
    );
    expect(issues.some((i) => i.severity === 'error' && /first keyframe/.test(i.message))).toBe(
      true
    );
  });

  it('flags bad follow target', () => {
    const issues = lintAnimation(
      sampleCharacter(),
      animationWith({
        keyframes: [
          {
            duration: 5,
            hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1, 0, 10, 1, 1, 0, 15, 1, 1],
            hitbubbles: [{ type: 'ground', follow: 'notabone', radius: 5 }],
          },
        ],
      })
    );
    expect(issues.some((i) => /follow target/.test(i.message))).toBe(true);
  });

  it('flags non-positive radius', () => {
    const issues = lintAnimation(
      sampleCharacter(),
      animationWith({
        keyframes: [
          {
            duration: 5,
            hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1, 0, 10, 1, 1, 0, 15, 1, 1],
            hitbubbles: [{ type: 'ground', follow: 'head', radius: 0 }],
          },
        ],
      })
    );
    expect(issues.some((i) => /non-positive radius/.test(i.message))).toBe(true);
  });

  it('flags non-positive duration', () => {
    const issues = lintAnimation(
      sampleCharacter(),
      animationWith({
        keyframes: [
          { duration: 0, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1, 0, 10, 1, 1, 0, 15, 1, 1] },
        ],
      })
    );
    expect(issues.some((i) => /duration/.test(i.message))).toBe(true);
  });

  it('flags animations with no keyframes', () => {
    const issues = lintAnimation(sampleCharacter(), { keyframes: [] });
    expect(issues.some((i) => i.severity === 'error' && /no keyframes/.test(i.message))).toBe(true);
  });
});
