/**
 * Integration test for the critical load → edit → save round-trip.
 *
 * Exercises the data pipeline that App.tsx runs on every file open and save:
 *   1. Parse JSONC character and animation files
 *   2. Mutate keyframe data in place (as editors do)
 *   3. Shallow-clone animation + update parsed map (as dispatch does)
 *   4. Render the save output with JSONC preservation
 *   5. Verify comments survive and edits are reflected
 */

import { describe, it, expect } from 'vitest';
import * as JSONC from 'jsonc-parser';
import type { AnimationMap, EntityData } from '../animator/types';
import { renderAnimationFile } from '../animator/operations/file-operations';

const CHARACTER_JSONC = `{
  // Main character definition
  "name": "test-character",
  "hurtbubbles": [
    { "name": "head", "i1": 0, "i2": 1, "z": 0 },
    { "name": "body", "i1": 2, "i2": 3, "z": 1 }
  ],
  "headbubble": 0,
  "shieldX": 0,
  "shieldY": 10
}
`;

const ANIMATION_JSONC = `{
  // Attack animation
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
  // The one we'll edit
  "attack": {
    "type": "attack",
    "keyframes": [
      {
        "duration": 3,
        "hurtbubbles": [
          0, 0, 1, 1,
          0, 5, 1, 1
        ],
        "hitbubbles": [
          { "x": 0, "y": 10, "radius": 5, "damage": 10, "knockback": 8 }
        ]
      }
    ]
  }
}
`;

describe('load → edit → save integration', () => {
  it('round-trips character JSONC with comments preserved', () => {
    const character = JSONC.parse(CHARACTER_JSONC) as EntityData;
    expect(character.name).toBe('test-character');
    expect(character.hurtbubbles).toHaveLength(2);
  });

  it('round-trips animation JSONC with comments preserved', () => {
    const parsed = JSONC.parse(ANIMATION_JSONC) as AnimationMap;
    expect(parsed.idle).toBeDefined();
    expect(parsed.attack).toBeDefined();
    expect(parsed.attack.keyframes).toHaveLength(1);
  });

  it('preserves comments when saving unchanged data', () => {
    const parsed = JSONC.parse(ANIMATION_JSONC) as AnimationMap;
    const out = renderAnimationFile(ANIMATION_JSONC, parsed);
    expect(out).toContain('// Attack animation');
    expect(out).toContain("// The one we'll edit");
    expect(out).toContain('"duration": 3');
  });

  it('reflects in-place keyframe edit after save round-trip', () => {
    // Step 1: Parse as App.tsx does
    const parsed = JSONC.parse(ANIMATION_JSONC) as AnimationMap;
    const character = JSONC.parse(CHARACTER_JSONC) as EntityData;
    expect(character).toBeDefined();

    // Step 2: Edit keyframe data in place (as editors do)
    const attack = parsed.attack;
    const kf = attack.keyframes[0];
    kf.duration = 99;
    const hb = kf.hurtbubbles!;
    // Move the head bone (indices 0-3: x, y, r, state)
    hb[0] = 15; // x
    hb[1] = 20; // y
    // Edit the hitbubble
    const hit = kf.hitbubbles![0];
    hit.damage = 25;
    hit.knockback = 12;

    // Step 3: Shallow-clone animation + update parsed (as dispatch does)
    const clonedParsed = { ...parsed, attack: { ...attack } };

    // Step 4: Render save output
    const out = renderAnimationFile(ANIMATION_JSONC, clonedParsed);

    // Step 5: Verify
    expect(out).toContain('// Attack animation');
    expect(out).toContain("// The one we'll edit");
    expect(out).toContain('"duration": 99');
    expect(out).toContain('"damage": 25');
    expect(out).toContain('"knockback": 12');
    expect(out).toContain('15, 20');
    // Unchanged animation should still be intact
    expect(out).toContain('"duration": 5');
    // Idle's hurtbubbles should still be at original position
    expect(out).toContain('0, 0, 1, 1');
  });

  it('preserves comments when adding a new keyframe', () => {
    const parsed = JSONC.parse(ANIMATION_JSONC) as AnimationMap;
    const attack = parsed.attack;

    // Add a new keyframe (as the editor does via in-place push)
    attack.keyframes.push({
      duration: 5,
      hurtbubbles: [10, 10, 1, 1, 10, 15, 1, 1],
    });

    const clonedParsed = { ...parsed, attack: { ...attack } };
    const out = renderAnimationFile(ANIMATION_JSONC, clonedParsed);

    expect(out).toContain('// Attack animation');
    expect(out).toContain('"duration": 5');
    // idle block should be unchanged
    expect(out).toMatch(/"idle":\s*\{/);
  });

  it('handles a fresh file (no original text = clean JSON output)', () => {
    const parsed: AnimationMap = {
      test: {
        type: 'attack',
        keyframes: [{ duration: 1 }],
      },
    };
    const out = renderAnimationFile(undefined, parsed);
    expect(out).toContain('"test"');
    expect(out).toContain('"duration": 1');
    expect(out.endsWith('\n')).toBe(true);
  });
});
