/**
 * Bubble finding utilities
 * PERFORMANCE CRITICAL - Called on every mouse move
 */

import type { HurtbubbleData, EntityData, Animation } from '../types';

/**
 * Create a map of hurtbubble names to indices
 * Used to resolve hitbubble "follow" property references
 */
export const hbmap = (hbs: HurtbubbleData[]) => {
  const m = new Map<string, number>();
  for (let i = 0; i < hbs.length; i++) {
    m.set(hbs[i].name, i + 1);
    m.set(`${hbs[i].name}2`, -i - 1);
  }
  return m;
};

/**
 * Find hurtbubbles under cursor position
 * Returns array of bubble indices sorted by distance (closest first)
 *
 * PERFORMANCE CRITICAL - Minimize allocations and calculations
 *
 * @param _character Entity data (unused, for future use)
 * @param animation Current animation
 * @param keyframe Current keyframe index
 * @param ox Camera offset X
 * @param oy Camera offset Y
 * @param w Canvas width
 * @param h Canvas height
 * @param scale Camera scale
 * @param x Mouse X position
 * @param y Mouse Y position
 * @returns Sorted array of bubble indices
 */
export const findBubbles = (
  _character: EntityData,
  animation: Animation,
  keyframe: number,
  ox: number,
  oy: number,
  w: number,
  h: number,
  scale: number,
  x: number,
  y: number
) => {
  const bubbles: number[] = [];
  const dists: number[] = [];
  const wx = (x - w * (0.5 + ox * 0.5)) / scale;
  const wy = -(y - h * (0.5 + oy * 0.5)) / scale;

  const hb = animation.keyframes[keyframe].hurtbubbles;

  for (let i = 0; i < hb.length; i = i + 4) {
    const [hbx, hby, hbr] = [hb[i + 0], hb[i + 1], hb[i + 2]];
    const dx = hbx - wx;
    const dy = hby - wy;
    const sqDist = dx * dx + dy * dy;
    const sqRadius = hbr * hbr;
    dists.push(sqDist);
    if (sqDist < sqRadius) {
      bubbles.push(i);
    }
  }
  return bubbles.sort((a, b) => {
    return dists[a * 0.25] - dists[b * 0.25];
  });
};
