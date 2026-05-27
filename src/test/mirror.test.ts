import { describe, it, expect } from 'vitest';
import { mirrorPose, mirrorHitbubble, mirrorAnimation } from '../animator/operations/mirror';
import { mirrorName, mirrorBubblePermutation } from '../animator/rendering/character-info';
import type { Animation, EntityData, Hitbubble } from '../animator/types';

const character: EntityData = {
  name: 'carbon',
  headbubble: 3,
  corebubble: 2,
  hurtbubbles: [
    { name: 'rfoot', i1: 1, i2: 0, z: 4 },
    { name: 'rleg', i1: 0, i2: 2, z: 4 },
    { name: 'body', i1: 2, i2: 2, z: 0 },
    { name: 'head', i1: 3, i2: 3, z: 0 },
    { name: 'lleg', i1: 4, i2: 2, z: -4 },
    { name: 'lfoot', i1: 5, i2: 4, z: -4 },
  ],
};

describe('mirrorName', () => {
  it('swaps single-letter side prefixes', () => {
    expect(mirrorName('rfoot')).toBe('lfoot');
    expect(mirrorName('lleg')).toBe('rleg');
  });
  it('swaps right/left words preserving case', () => {
    expect(mirrorName('rightHand')).toBe('leftHand');
    expect(mirrorName('LeftArm')).toBe('RightArm');
  });
  it('leaves centre names unchanged', () => {
    expect(mirrorName('body')).toBe('body');
    expect(mirrorName('headbubble')).toBe('headbubble');
  });
});

describe('mirrorBubblePermutation', () => {
  it('pairs left/right bubble indices and is an involution', () => {
    const perm = mirrorBubblePermutation(character);
    expect(perm).toEqual([4, 5, 2, 3, 0, 1]);
    // involution: perm[perm[i]] === i
    perm.forEach((p, i) => expect(perm[p]).toBe(i));
  });
});

describe('mirrorPose', () => {
  it('negates x, swaps paired bubbles, preserves r and state', () => {
    const perm = mirrorBubblePermutation(character);
    // bubble 1 (rfoot.i1) at (10, 5, 4, 1); bubble 5 (lfoot.i1) at (-8, 6, 3, 2)
    const pose = [
      0,
      0,
      9,
      1, // 0
      10,
      5,
      4,
      1, // 1
      1,
      35,
      9,
      1, // 2
      5,
      52,
      10,
      1, // 3
      0,
      0,
      9,
      3, // 4
      -8,
      6,
      3,
      2, // 5
    ];
    const out = mirrorPose(pose, perm);
    // index 1 now holds negated-x of index 5
    expect(out.slice(4, 8)).toEqual([8, 6, 3, 2]);
    // index 5 now holds negated-x of index 1
    expect(out.slice(20, 24)).toEqual([-10, 5, 4, 1]);
    // centre bubble 3 just negates x
    expect(out.slice(12, 16)).toEqual([-5, 52, 10, 1]);
  });

  it('round-trips (mirror twice == identity)', () => {
    const perm = mirrorBubblePermutation(character);
    const pose = [1, 2, 3, 1, 10, 5, 4, 1, 1, 35, 9, 1, 5, 52, 10, 1, -2, -3, 9, 3, -8, 6, 3, 2];
    expect(mirrorPose(mirrorPose(pose, perm), perm)).toEqual(pose);
  });
});

describe('mirrorHitbubble', () => {
  it('negates x/x2, flips angle about vertical, swaps follow side', () => {
    const hb: Hitbubble = { type: 'ground', x: 12, x2: 4, angle: 45, follow: 'rfoot' };
    mirrorHitbubble(hb);
    expect(hb.x).toBe(-12);
    expect(hb.x2).toBe(-4);
    expect(hb.angle).toBe(135);
    expect(hb.follow).toBe('lfoot');
  });
  it('flips a straight-up angle to itself and 0 to 180', () => {
    const up: Hitbubble = { angle: 90 };
    mirrorHitbubble(up);
    expect(up.angle).toBe(90);
    const right: Hitbubble = { angle: 0 };
    mirrorHitbubble(right);
    expect(right.angle).toBe(180);
  });
  it('mirrors smear offset and follow', () => {
    const hb: Hitbubble = { x: 5, smear: { x: 3, follow: 'rleg' } };
    mirrorHitbubble(hb);
    expect((hb.smear as { x: number }).x).toBe(-3);
    expect((hb.smear as { follow: string }).follow).toBe('lleg');
  });
});

describe('mirrorAnimation', () => {
  it('mirrors every keyframe in place and round-trips', () => {
    const anim: Animation = {
      name: 'jab',
      keyframes: [
        {
          duration: 3,
          hurtbubbles: [
            0, 0, 9, 1, 10, 5, 4, 1, 1, 35, 9, 1, 5, 52, 10, 1, 0, 0, 9, 1, -8, 6, 3, 1,
          ],
          hitbubbles: [{ type: 'ground', x: 12, angle: 30, follow: 'rfoot' }],
        },
        { duration: 2, hitbubbles: true },
      ],
    };
    const snapshot = JSON.parse(JSON.stringify(anim));
    mirrorAnimation(character, anim);
    expect(anim.keyframes[0].hitbubbles[0].x).toBe(-12);
    expect(anim.keyframes[0].hitbubbles[0].follow).toBe('lfoot');
    // continuation keyframe untouched
    expect(anim.keyframes[1].hitbubbles).toBe(true);
    // round-trip
    mirrorAnimation(character, anim);
    expect(anim).toEqual(snapshot);
  });
});
