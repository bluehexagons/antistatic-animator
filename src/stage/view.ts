import type { CameraState } from '../animator/context/AnimatorContext';
import type { StageDocument, Vec2 } from './types';

export interface StageAuthoringBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const includePoint = (bounds: StageAuthoringBounds, point: Vec2) => {
  bounds.minX = Math.min(bounds.minX, point[0]);
  bounds.minY = Math.min(bounds.minY, point[1]);
  bounds.maxX = Math.max(bounds.maxX, point[0]);
  bounds.maxY = Math.max(bounds.maxY, point[1]);
};

export const stageAuthoringBounds = (stage: StageDocument): StageAuthoringBounds => {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };

  for (const collision of stage.scene.collision ?? []) {
    includePoint(bounds, collision.from);
    includePoint(bounds, collision.to);
  }
  for (const point of [...stage.anchors, ...stage.entrances, ...stage.spawns]) {
    includePoint(bounds, [point.x, point.y]);
  }
  for (const animation of stage.scene.animations ?? []) {
    for (const track of animation.tracks) {
      if (track.target.kind !== 'collision') continue;
      const collision = stage.scene.collision?.find((item) => item.id === track.target.id);
      const offset: Vec2 = collision
        ? [collision.to[0] - collision.from[0], collision.to[1] - collision.from[1]]
        : [0, 0];
      for (const keyframe of track.keyframes) {
        const point = keyframe.position as Vec2;
        includePoint(bounds, point);
        includePoint(bounds, [point[0] + offset[0], point[1] + offset[1]]);
      }
    }
  }

  if (!Number.isFinite(bounds.minX)) {
    for (const model of stage.scene.models ?? []) {
      const position = model.position ?? [0, 0, 0];
      const size = model.size ?? model.scale ?? [50, 50, 50];
      includePoint(bounds, [
        position[0] - Math.abs(size[0]) / 2,
        position[1] - Math.abs(size[1]) / 2,
      ]);
      includePoint(bounds, [
        position[0] + Math.abs(size[0]) / 2,
        position[1] + Math.abs(size[1]) / 2,
      ]);
    }
  }
  if (!Number.isFinite(bounds.minX)) {
    return { minX: -100, minY: -75, maxX: 100, maxY: 75 };
  }
  return bounds;
};

export const cameraForStageBounds = (
  bounds: StageAuthoringBounds,
  width: number,
  height: number
): CameraState => {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const spanX = Math.max(50, bounds.maxX - bounds.minX);
  const spanY = Math.max(50, bounds.maxY - bounds.minY);
  const scale = Math.min(
    8,
    Math.max(0.05, Math.min((safeWidth * 0.78) / spanX, (safeHeight * 0.72) / spanY))
  );
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    x: (-2 * centerX * scale) / safeWidth,
    y: (-2 * centerY * scale) / safeHeight,
    scale,
  };
};
