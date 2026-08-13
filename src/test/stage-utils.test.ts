import { describe, expect, it } from 'vitest';
import type { Animation, EntityData } from '../animator/types';
import { hitbubblesForKeyframe, resolveHitbubble } from '../app/stage/stage-utils';

const character: EntityData = {
  name: 'fixture',
  hurtbubbles: [{ name: 'head', i1: 0, i2: 0, z: 0 }],
};

describe('character hitbubble preview helpers', () => {
  it('matches runtime authored Y conversion and expands smear:true', () => {
    const pose = [10, 20, 5, 1];
    const resolved = resolveHitbubble(
      { follow: 'head', x: 3, y: 4, radius: 2, smear: true },
      character,
      pose
    );

    expect(resolved.x).toBe(13);
    expect(resolved.y).toBe(16);
    expect(resolved.smearX).toBe(13);
    expect(resolved.smearY).toBe(16);
    expect(resolved.hasSmear).toBe(true);
  });

  it('expands continuation and next hitbubbles without mutating source data', () => {
    const hitbubble = { x: 2, y: 3, radius: 4, next: true };
    const animation: Animation = {
      keyframes: [
        { duration: 2, hitbubbles: [hitbubble] },
        { duration: 1, hitbubbles: [] },
        { duration: 1, hurtbubbles: [0, 0, 1, 1] },
      ],
    };

    expect(hitbubblesForKeyframe(animation, 1)).toHaveLength(1);
    expect(hitbubblesForKeyframe(animation, 1)[0]).toMatchObject({ start: 0, end: 1 });
    animation.keyframes[1].hitbubbles = true;
    expect(hitbubblesForKeyframe(animation, 1)).toHaveLength(1);
    expect(hitbubble.next).toBe(true);
    expect(hitbubblesForKeyframe(animation, 2)).toEqual([]);
  });

  it('ignores invalid numeric follow references instead of crashing the preview', () => {
    expect(() => resolveHitbubble({ follow: 99, x: 1 }, character, [0, 0, 1, 1])).not.toThrow();
    expect(() =>
      resolveHitbubble({ smear: { follow: -99 }, x: 1 }, character, [0, 0, 1, 1])
    ).not.toThrow();
  });
});
