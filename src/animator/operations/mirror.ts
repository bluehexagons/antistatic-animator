/**
 * Horizontal (flip-X) mirroring of an animation.
 *
 * Mirrors the silhouette across the y-axis: negate every x coordinate and
 * swap the data of left/right bone pairs so a right-side limb ends up where
 * the left one was. Hitbubble knockback angles flip about the vertical
 * (`180 - angle`) and `follow` targets swap sides.
 *
 * The transform is an involution — applying it twice restores the original —
 * so the editor can offer it as a safely reversible toggle. Mutates the
 * animation in place (consistent with the editor's drag-to-edit model).
 */

import type { Animation, EntityData, Hitbubble } from '../types';
import { mirrorBubblePermutation, mirrorName } from '../rendering/character-info';

/** Normalise a degree value into [0, 360). */
const norm = (deg: number): number => ((deg % 360) + 360) % 360;

/** Mirror one flat hurtbubble pose array using a bubble-index permutation.
 *  Returns a new array; does not mutate the input. */
export const mirrorPose = (pose: number[], perm: number[]): number[] => {
  const out = pose.slice();
  const count = Math.floor(pose.length / 4);
  for (let a = 0; a < count; a++) {
    const from = perm[a] ?? a;
    out[a * 4] = -pose[from * 4]; // x negated
    out[a * 4 + 1] = pose[from * 4 + 1]; // y
    out[a * 4 + 2] = pose[from * 4 + 2]; // radius
    out[a * 4 + 3] = pose[from * 4 + 3]; // state (discrete)
  }
  return out;
};

/** Mirror a single hitbubble in place. */
export const mirrorHitbubble = (hb: Hitbubble): void => {
  if (typeof hb.x === 'number') hb.x = -hb.x;
  if (typeof hb.x2 === 'number') hb.x2 = -hb.x2;
  if (typeof hb.angle === 'number') hb.angle = norm(180 - hb.angle);
  if (typeof hb.follow === 'string' && hb.follow) hb.follow = mirrorName(hb.follow);
  const smear = hb.smear as { follow?: string; x?: number } | undefined;
  if (smear) {
    if (typeof smear.x === 'number') smear.x = -smear.x;
    if (typeof smear.follow === 'string' && smear.follow) smear.follow = mirrorName(smear.follow);
  }
};

/** Mirror every keyframe of an animation in place. */
export const mirrorAnimation = (character: EntityData, animation: Animation): void => {
  const perm = mirrorBubblePermutation(character);
  for (const kf of animation.keyframes) {
    if (Array.isArray(kf.hurtbubbles)) {
      const mirrored = mirrorPose(kf.hurtbubbles as number[], perm);
      for (let i = 0; i < mirrored.length; i++) (kf.hurtbubbles as number[])[i] = mirrored[i];
    }
    if (Array.isArray(kf.hitbubbles)) {
      for (const hb of kf.hitbubbles) mirrorHitbubble(hb);
    }
  }
};
