/**
 * Tests for JSONC-preserving save.
 * The save path should leave comments and untouched animations alone,
 * only rewriting the entries that actually changed in memory.
 */

import { describe, it, expect } from 'vitest';
import { renderAnimationFile, buildJsoncEdits } from '../animator/operations/file-operations';
import type { AnimationMap } from '../animator/types';

const ORIGINAL = `{
  // header comment about this file
  "idle": {
    "type": "movement",
    "keyframes": [
      {
        "duration": 5,
        "hurtbubbles": [
          0, 0, 1, 1,
          0, 5, 1, 1
        ]
      }
    ]
  },
  // about-to-edit anim
  "attack": {
    "type": "attack",
    "keyframes": [
      {
        "duration": 3,
        "hurtbubbles": [
          0, 0, 1, 1,
          0, 5, 1, 1
        ]
      }
    ]
  }
}
`;

describe('renderAnimationFile', () => {
  it('preserves comments when no animation changed', () => {
    const parsed: AnimationMap = {
      idle: {
        type: 'movement',
        keyframes: [{ duration: 5, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1] }],
      },
      attack: {
        type: 'attack',
        keyframes: [{ duration: 3, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1] }],
      },
    };
    const out = renderAnimationFile(ORIGINAL, parsed);
    expect(out).toContain('// header comment about this file');
    expect(out).toContain('// about-to-edit anim');
  });

  it('rewrites only the changed animation entry', () => {
    const parsed: AnimationMap = {
      idle: {
        type: 'movement',
        keyframes: [{ duration: 5, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1] }],
      },
      attack: {
        type: 'attack',
        keyframes: [{ duration: 99, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1] }],
      },
    };
    const out = renderAnimationFile(ORIGINAL, parsed);
    expect(out).toContain('// header comment about this file');
    expect(out).toContain('// about-to-edit anim');
    expect(out).toMatch(/"duration":\s*99/);
    // Idle was unchanged — its block should still look the same:
    expect(out).toMatch(/"idle":\s*{[\s\S]*?"duration":\s*5/);
  });

  it('removes an animation that is no longer present', () => {
    const parsed: AnimationMap = {
      idle: {
        type: 'movement',
        keyframes: [{ duration: 5, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1] }],
      },
    };
    const edits = buildJsoncEdits(ORIGINAL, parsed);
    expect(edits.length).toBeGreaterThan(0);
    const out = renderAnimationFile(ORIGINAL, parsed);
    expect(out).not.toContain('"attack"');
    expect(out).toContain('// header comment about this file');
  });

  it('falls back to JSON.stringify when there is no original text', () => {
    const parsed: AnimationMap = {
      idle: {
        type: 'movement',
        keyframes: [{ duration: 5, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1] }],
      },
    };
    const out = renderAnimationFile(undefined, parsed);
    expect(out).toContain('"idle"');
    expect(out).toContain('"duration": 5');
  });

  it('falls back to JSON.stringify when the original text is malformed', () => {
    const parsed: AnimationMap = {
      idle: {
        type: 'movement',
        keyframes: [{ duration: 5, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1] }],
      },
    };
    const out = renderAnimationFile('{ "idle": ', parsed);
    expect(out).toContain('"idle"');
    expect(out).toContain('"duration": 5');
    expect(out).not.toContain('{ "idle": ');
  });

  it('always ends with a trailing newline', () => {
    const parsed: AnimationMap = {
      idle: {
        type: 'movement',
        keyframes: [{ duration: 5, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1] }],
      },
      attack: {
        type: 'attack',
        keyframes: [{ duration: 3, hurtbubbles: [0, 0, 1, 1, 0, 5, 1, 1] }],
      },
    };
    expect(renderAnimationFile(ORIGINAL, parsed).endsWith('\n')).toBe(true);
    expect(renderAnimationFile(undefined, parsed).endsWith('\n')).toBe(true);
  });
});
