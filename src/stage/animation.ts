import type {
  StageAnimation,
  StageAnimationKeyframe,
  StageMaterialKeyframe,
  StageDocument,
  Vec2,
  Vec3,
} from './types';
import { isStageRotationTrack, isStageMaterialTrack } from './types';
import { stageAuthoredEmission } from './emission';
import { stageModelDisplayPosition } from './view';

export interface StageAnimationPreview {
  /** Positions converted into the stage viewer's authored collision coordinate space. */
  models: Map<string, Vec3>;
  collision: Map<string, { from: Vec2; to: Vec2 }>;
  rotations: Map<string, number>;
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
    rotations: new Map(),
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
    if (isStageRotationTrack(track)) {
      const collision = stage.scene.collision?.find(
        (face) => face.id.trim() === track.target.id.trim()
      );
      if (!collision) continue;
      const keys = track.keyframes;
      const index = keys.findIndex((key) => key.time >= frame);
      const a = index <= 0 ? keys[index < 0 ? keys.length - 1 : 0] : keys[index - 1];
      const b = index < 0 ? a : keys[index];
      if (!a || !b) continue;
      const t = Math.max(0, Math.min(1, (frame - a.time) / (b.time - a.time || 1)));
      const angle = (a.angle + (b.angle - a.angle) * t) * Math.PI;
      const c = Math.cos(angle),
        s = Math.sin(angle);
      const offset: Vec2 = [0, 1].map(
        (axis) => (a.offset?.[axis] ?? 0) * (1 - t) + (b.offset?.[axis] ?? 0) * t
      ) as Vec2;
      const point = ([x, y]: Vec2): Vec2 => [
        track.pivot[0] + offset[0] + c * (x - track.pivot[0]) - s * (y - track.pivot[1]),
        track.pivot[1] + offset[1] + s * (x - track.pivot[0]) + c * (y - track.pivot[1]),
      ];
      for (const face of stage.scene.collision ?? []) {
        if (
          face === collision ||
          (collision.model && face.model?.trim() === collision.model.trim())
        )
          preview.collision.set(face.id, { from: point(face.from), to: point(face.to) });
      }
      const model = stage.scene.models?.find(
        (model) => model.id.trim() === collision.model?.trim()
      );
      if (model) {
        const source = stageModelDisplayPosition(stage, model.position ?? [0, 0, 0]);
        const moved = point([source[0], source[1]]);
        preview.models.set(model.id, [...moved, source[2]]);
        preview.rotations.set(model.id, angle);
      }
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
