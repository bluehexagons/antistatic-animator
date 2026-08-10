/**
 * Stage utilities — pure rendering helpers for the SVG stage viewer.
 */

import { objHas } from '../../utils';
import { hbmap } from '../../animator/rendering/bubble-finder';
import type { Animation, EntityData, Hitbubble } from '../../animator/types';

/**
 * Build a capsule polygon from two circle centres and a shared radius.
 * Returns SVG points-attribute string for a 9-vertex approximation.
 */
export function getCapsulePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number
): string {
  const points: number[] = [];
  const rads = 2 * Math.PI - Math.atan2(x2 - x1, y2 - y1);
  let perp = rads - Math.PI;
  const step = Math.PI / 4;
  for (let i = 0; i < 4; i++) {
    points.push(x1 + Math.cos(perp) * r, y1 + Math.sin(perp) * r);
    perp += step;
  }
  perp = rads + Math.PI * 2;
  for (let i = 0; i < 5; i++) {
    points.push(x2 + Math.cos(perp) * r, y2 + Math.sin(perp) * r);
    perp += step;
  }
  return points.map((n) => n.toFixed(2)).join(' ');
}

/**
 * Resolve a hitbubble's world position, including follow + smear anchors.
 */
export function resolveHitbubble(
  hb: Hitbubble,
  character: EntityData,
  hurtbubbles: number[] | null
): {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  hasAnchor: boolean;
  smearX: number;
  smearY: number;
  smearAnchorX: number;
  smearAnchorY: number;
  hasSmear: boolean;
  smearAnchorPresent: boolean;
} {
  let x = hb.x ?? 0;
  // Hitbubble authored Y is inverted by Hitbubble's runtime constructor.
  let y = -(hb.y ?? 0);
  let anchorX = 0;
  let anchorY = 0;
  let hasAnchor = false;
  const smear = hb.smear === true ? { follow: hb.follow, x: hb.x, y: hb.y } : hb.smear;
  let smearX = smear?.x ?? hb.x ?? 0;
  let smearY = -(smear?.y ?? hb.y ?? 0);
  let hasSmear = !!hb.smear;
  let smearAnchorX = 0;
  let smearAnchorY = 0;
  let smearAnchorPresent = false;
  const map = hbmap(character.hurtbubbles);
  const followIndex = (follow: string | number | undefined) =>
    typeof follow === 'number' ? follow : follow === undefined ? undefined : map.get(follow);

  if (hurtbubbles && objHas(hb, 'follow')) {
    const idx = followIndex(hb.follow);
    if (idx !== undefined && idx !== 0) {
      const b = character.hurtbubbles[Math.abs(idx) - 1];
      const base = 4 * (idx > 0 ? b.i1 : b.i2);
      anchorX = hurtbubbles[base] ?? 0;
      anchorY = hurtbubbles[base + 1] ?? 0;
      x += anchorX;
      y += anchorY;
      hasAnchor = true;
    }
  }
  if (hurtbubbles && hasSmear) {
    if (smear?.follow) {
      const idx = followIndex(smear.follow);
      if (idx !== undefined && idx !== 0) {
        const b = character.hurtbubbles[Math.abs(idx) - 1];
        const base = 4 * (idx > 0 ? b.i1 : b.i2);
        smearAnchorX = hurtbubbles[base] ?? 0;
        smearAnchorY = hurtbubbles[base + 1] ?? 0;
        smearX += smearAnchorX;
        smearY += smearAnchorY;
        smearAnchorPresent = true;
      }
    } else if (hasAnchor) {
      smearX += anchorX;
      smearY += anchorY;
    }
  }

  return {
    x,
    y,
    anchorX,
    anchorY,
    hasAnchor,
    smearX,
    smearY,
    smearAnchorX,
    smearAnchorY,
    hasSmear,
    smearAnchorPresent,
  };
}

/**
 * Resolve the editor-visible hitbubble list without mutating authored data.
 * The game expands continuations, `smear: true`, and `next` hitbubbles while
 * loading an animation; previews need those same forms to be useful.
 */
export function hitbubblesForKeyframe(animation: Animation, keyframe: number): Hitbubble[] {
  const current = animation.keyframes[keyframe];
  if (!current || keyframe >= animation.keyframes.length - 1) return [];

  let source: Hitbubble[] | undefined;
  if (Array.isArray(current.hitbubbles)) {
    source = current.hitbubbles;
  } else if (current.hitbubbles === true) {
    for (let i = keyframe - 1; i >= 0; i--) {
      if (Array.isArray(animation.keyframes[i]?.hitbubbles)) {
        source = animation.keyframes[i].hitbubbles as Hitbubble[];
        break;
      }
    }
  }

  const result = source ? source.map((hb) => ({ ...hb })) : [];
  if (current.hitbubbles === true && source) {
    const previousDuration = animation.keyframes
      .slice(0, keyframe)
      .reverse()
      .find((item) => Array.isArray(item.hitbubbles))?.duration;
    const duration = current.duration ?? 0;
    for (const hb of result) {
      const sourceDuration = previousDuration || duration || 1;
      hb.start = (duration * (hb.start || 0)) / sourceDuration;
      hb.end = (duration * (hb.end || sourceDuration)) / sourceDuration;
      hb.smear = { follow: hb.follow, x: hb.x, y: hb.y };
    }
  }
  if (current.hitbubbles !== true && keyframe > 0) {
    const previous = animation.keyframes[keyframe - 1]?.hitbubbles;
    if (Array.isArray(previous)) {
      for (const hb of previous) {
        if (!hb.next) continue;
        const generated: Hitbubble = {
          ...hb,
          start: 0,
          end: 1,
          smear: { follow: hb.follow, x: hb.x, y: hb.y },
        };
        delete (generated as Record<string, unknown>).next;
        result.push(generated);
      }
    }
  }
  return result;
}

/**
 * Bone-z to tint nudge for the bones' capsule color (front warmer / back cooler).
 */
export function zTint(z: number | undefined): { fill: string; stroke: string } {
  if (z === undefined || z === 0) {
    return { fill: 'rgba(205, 210, 220, 0.32)', stroke: 'rgba(20, 23, 28, 0.85)' };
  }
  if (z > 0) {
    return { fill: 'rgba(255, 215, 180, 0.34)', stroke: 'rgba(60, 30, 20, 0.85)' };
  }
  return { fill: 'rgba(170, 200, 230, 0.30)', stroke: 'rgba(20, 30, 50, 0.85)' };
}
