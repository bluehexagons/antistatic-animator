import type { StageAnimation, StageAnimationKeyframe, StageDocument, Vec2, Vec3 } from './types';

export interface StageAnimationPreview {
  models: Map<string, Vec3>;
  collision: Map<string, { from: Vec2; to: Vec2 }>;
}

export const stageAnimationDuration = (animation: StageAnimation): number => {
  if (animation.duration !== undefined && animation.duration > 0) return animation.duration;
  let lastFrame = 0;
  for (const track of animation.tracks) {
    for (const keyframe of track.keyframes) lastFrame = Math.max(lastFrame, keyframe.time);
  }
  return lastFrame + 1;
};

export const sampleStagePosition = (
  keyframes: StageAnimationKeyframe[],
  frame: number
): Vec2 | Vec3 | undefined => {
  if (keyframes.length === 0) return undefined;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  if (frame <= sorted[0].time) return [...sorted[0].position] as Vec2 | Vec3;
  const last = sorted[sorted.length - 1];
  if (frame >= last.time) return [...last.position] as Vec2 | Vec3;

  const nextIndex = sorted.findIndex((keyframe) => keyframe.time >= frame);
  const previous = sorted[nextIndex - 1];
  const next = sorted[nextIndex];
  const progress = (frame - previous.time) / (next.time - previous.time || 1);
  return previous.position.map(
    (value, index) => value + ((next.position[index] ?? value) - value) * progress
  ) as Vec2 | Vec3;
};

export const evaluateStageAnimation = (
  stage: StageDocument,
  animation: StageAnimation | undefined,
  frame: number
): StageAnimationPreview => {
  const preview: StageAnimationPreview = { models: new Map(), collision: new Map() };
  if (!animation) return preview;

  for (const track of animation.tracks) {
    const position = sampleStagePosition(track.keyframes, frame);
    if (!position) continue;
    if (track.target.kind === 'model') {
      if (position.length === 3) preview.models.set(track.target.id, position as Vec3);
      continue;
    }
    const collision = stage.scene.collision?.find((item) => item.id === track.target.id);
    if (!collision || position.length !== 2) continue;
    const from = position as Vec2;
    const offset: Vec2 = [collision.to[0] - collision.from[0], collision.to[1] - collision.from[1]];
    preview.collision.set(track.target.id, {
      from,
      to: [from[0] + offset[0], from[1] + offset[1]],
    });
  }
  return preview;
};
