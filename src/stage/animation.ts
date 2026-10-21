import type {
  StageAnimation,
  StageAnimationKeyframe,
  StageMaterialKeyframe,
  StageDocument,
  Vec2,
  Vec3,
} from './types';
import { isStageMaterialTrack } from './types';
import { stageAuthoredEmission } from './emission';
import { stageModelDisplayPosition } from './view';

export interface StageAnimationPreview {
  /** Positions converted into the stage viewer's authored collision coordinate space. */
  models: Map<string, Vec3>;
  collision: Map<string, { from: Vec2; to: Vec2 }>;
  /** Model ID -> original source slot -> sampled authored emission. Does not mutate the document. */
  materials: Map<string, Map<string, { emissive: Vec3; emissiveStrength: number }>>;
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

export const sampleStageMaterial = (
  keyframes: StageMaterialKeyframe[],
  frame: number
): Vec3 | number | undefined => {
  if (!keyframes.length) return undefined;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const nextIndex = sorted.findIndex((keyframe) => keyframe.time >= frame);
  const previous =
    nextIndex <= 0
      ? nextIndex < 0
        ? sorted[sorted.length - 1]
        : sorted[0]
      : sorted[nextIndex - 1];
  const next = nextIndex < 0 ? previous : sorted[nextIndex];
  const progress = Math.max(
    0,
    Math.min(1, (frame - previous.time) / (next.time - previous.time || 1))
  );
  if (typeof previous.value === 'number' && typeof next.value === 'number')
    return previous.value + (next.value - previous.value) * progress;
  if (Array.isArray(previous.value) && Array.isArray(next.value)) {
    const end = next.value;
    return previous.value.map((value, index) => value + (end[index] - value) * progress) as Vec3;
  }
  return undefined;
};

export const evaluateStageAnimation = (
  stage: StageDocument,
  animation: StageAnimation | undefined,
  frame: number
): StageAnimationPreview => {
  const preview: StageAnimationPreview = {
    models: new Map(),
    collision: new Map(),
    materials: new Map(),
  };
  if (!animation) return preview;

  for (const track of animation.tracks) {
    if (isStageMaterialTrack(track)) {
      const model = stage.scene.models?.find((item) => item.id.trim() === track.target.id.trim());
      const value = sampleStageMaterial(track.keyframes, frame);
      if (!model || value === undefined) continue;
      const slots = preview.materials.get(model.id) ?? new Map();
      preview.materials.set(model.id, slots);
      const slot = track.target.materialSlot.trim();
      const emission = slots.get(slot) ?? stageAuthoredEmission(stage, model, slot);
      if (track.target.property === 'emissive' && Array.isArray(value)) emission.emissive = value;
      if (track.target.property === 'emissiveStrength' && typeof value === 'number')
        emission.emissiveStrength = value;
      slots.set(slot, emission);
      continue;
    }
    const position = sampleStagePosition(track.keyframes, frame);
    if (!position) continue;
    if (track.target.kind === 'model') {
      const model = stage.scene.models?.find((item) => item.id.trim() === track.target.id.trim());
      if (model && position.length === 3) {
        preview.models.set(model.id, stageModelDisplayPosition(stage, position as Vec3));
      }
      continue;
    }
    const collision = stage.scene.collision?.find(
      (item) => item.id.trim() === track.target.id.trim()
    );
    if (!collision || position.length !== 2) continue;
    const from = position as Vec2;
    const offset: Vec2 = [collision.to[0] - collision.from[0], collision.to[1] - collision.from[1]];
    preview.collision.set(collision.id, {
      from,
      to: [from[0] + offset[0], from[1] + offset[1]],
    });
    const model = stage.scene.models?.find((item) => item.id.trim() === collision.model?.trim());
    if (model) {
      // Antistatic keeps a collision's visual model attached to the segment
      // while it moves, rather than requiring a second model track.
      preview.models.set(model.id, [from[0] + offset[0] * 0.5, from[1] + 2, 0]);
    }
  }
  return preview;
};
