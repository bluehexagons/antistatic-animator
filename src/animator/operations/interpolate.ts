/** Runtime-compatible pose preparation and preview helpers. */

import { easeFn } from '../../easing';
import type { Animation } from '../types';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Resolve the authored pose after the engine fills `hurtbubbles: true` gaps. */
export const resolvedPose = (animation: Animation, keyframe: number): number[] | null => {
  for (let i = keyframe; i >= 0; i--) {
    const pose = animation.keyframes[i]?.hurtbubbles;
    if (Array.isArray(pose)) return pose;
  }
  return null;
};

const nextPoseIndex = (animation: Animation, keyframe: number): number => {
  for (let i = keyframe + 1; i < animation.keyframes.length; i++) {
    if (Array.isArray(animation.keyframes[i]?.hurtbubbles)) return i;
  }
  return -1;
};

const sourcePoseIndex = (animation: Animation, keyframe: number): number => {
  for (let i = keyframe; i >= 0; i--) {
    if (Array.isArray(animation.keyframes[i]?.hurtbubbles)) return i;
  }
  return -1;
};

/**
 * Compute the displayed pose using the engine's terminal-frame and omitted
 * keyframe rules. The final keyframe is a destination pose and contributes no
 * playable duration; intermediate keyframes without a pose extend the motion.
 */
export const interpolatedPose = (
  animation: Animation,
  keyframe: number,
  tick: number
): number[] | null => {
  const kf = animation.keyframes[keyframe];
  const source = sourcePoseIndex(animation, keyframe);
  const authoredFrom = resolvedPose(animation, source === -1 ? keyframe : source);
  if (!kf || !authoredFrom || keyframe >= animation.keyframes.length - 1) return authoredFrom;

  // `interpolate: true` starts from the previous runtime pose, which can be
  // fractionally short of the authored destination because the engine samples
  // with `(frame + 1) / (duration + 1)`.
  const from =
    kf.interpolate === true && keyframe > 0
      ? (interpolatedPose(
          animation,
          keyframe - 1,
          Math.max(0, (animation.keyframes[keyframe - 1].duration ?? 1) - 1)
        ) ?? authoredFrom)
      : authoredFrom;

  const next = nextPoseIndex(animation, source === -1 ? keyframe : source);
  if (next === -1) return from;
  const motionDuration = animation.keyframes
    .slice(source, next)
    .reduce((sum, item) => sum + (item.duration ?? 0), 0);
  if (motionDuration <= 0) return from;

  const elapsed =
    animation.keyframes
      .slice(source, keyframe)
      .reduce((sum, item) => sum + (item.duration ?? 0), 0) + Math.max(0, tick);
  const t = Math.max(0, Math.min(1, (elapsed + 1) / (motionDuration + 1)));
  const ease = easeFn((kf as { tween?: string }).tween);
  const u = ease(t);

  const b = animation.keyframes[next].hurtbubbles;
  if (!Array.isArray(b)) return from;
  const a = from;
  if (a.length !== b.length) {
    console.warn(
      `interpolatedPose: keyframe ${keyframe} hurtbubble count (${a.length}) ` +
        `differs from target keyframe (${b.length}); skipping interpolation`
    );
    return from;
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
