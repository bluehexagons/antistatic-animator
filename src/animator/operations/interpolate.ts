/**
 * Pose interpolation between adjacent keyframes.
 *
 * Mirrors the engine's per-keyframe `interpolate: true` + `tween: '<easing>'`
 * authoring: a smooth pose blend from this keyframe's pose toward the next
 * keyframe's pose, parameterised by tick / duration.
 */

import { easeFn } from '../../easing';
import type { Animation } from '../types';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Compute the displayed hurtbubble pose for the current animation state.
 * Returns the keyframe's own hurtbubbles when:
 *   - `interpolate` is not set on the current keyframe
 *   - there is no next keyframe to blend toward
 *   - tick is 0
 *
 * Otherwise returns a freshly allocated array with each (x, y, r) lerped
 * by the configured ease curve. The `state` column is preserved from the
 * source keyframe — discrete fields don't tween.
 */
export const interpolatedPose = (
  animation: Animation,
  keyframe: number,
  tick: number
): number[] | null => {
  const kf = animation.keyframes[keyframe];
  if (!kf) return null;
  const hb = kf.hurtbubbles;
  if (!Array.isArray(hb)) return null;

  if (!(kf as { interpolate?: boolean }).interpolate || tick <= 0) {
    return hb;
  }
  const next = animation.keyframes[keyframe + 1];
  if (!next || !Array.isArray(next.hurtbubbles)) {
    return hb;
  }
  const dur = kf.duration ?? 1;
  const t = Math.max(0, Math.min(1, tick / dur));
  const ease = easeFn((kf as { tween?: string }).tween);
  const u = ease(t);

  const a = hb;
  const b = next.hurtbubbles;
  if (a.length !== b.length) {
    console.warn(
      `interpolatedPose: keyframe ${keyframe} hurtbubble count (${a.length}) ` +
        `differs from next keyframe (${b.length}); skipping interpolation`
    );
    return hb;
  }
  const len = a.length;
  const out: number[] = [];
  out.length = len;
  for (let i = 0; i < len; i += 4) {
    out[i] = lerp(a[i], b[i], u);
    out[i + 1] = lerp(a[i + 1], b[i + 1], u);
    out[i + 2] = lerp(a[i + 2], b[i + 2], u);
    out[i + 3] = a[i + 3]; // state is discrete
  }
  return out;
};
