import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraState } from '../animator/context/AnimatorContext';
import {
  emissionSwatch,
  stageAuthoredEmission,
  stageMaterialSlots,
  stageSourceTransform,
} from '../stage/emission';
import { evaluateStageAnimation } from '../stage/animation';
import {
  cameraForStageBounds,
  stageAuthoringBounds,
  stageModelDisplayHalfExtents,
  stageModelDisplayPosition,
} from '../stage/view';
import type { StageAnimation, StageDocument, StageSelection, Vec2, Vec3 } from '../stage/types';

export interface StageSceneViewerProps {
  stage: StageDocument;
  selection: StageSelection;
  camera: CameraState;
  onSelect: (selection: StageSelection) => void;
  onCameraChange: (camera: Partial<CameraState>) => void;
  onChange: () => void;
  showGrid: boolean;
  previewAnimation?: StageAnimation;
  previewFrame?: number;
  onBeginEdit?: () => void;
  fitRequest?: number;
}

const selected = (selection: StageSelection, kind: StageSelection['kind'], id: string) =>
  selection.kind === kind && selection.id === id;

type DragHandle =
  | 'move'
  | 'source-offset'
  | 'collision-from'
  | 'collision-to'
  | 'fog-radius'
  | 'emitter-size'
  | 'light-range'
  | 'model-size'
  | 'blast-left'
  | 'blast-top'
  | 'blast-right'
  | 'blast-bottom'
  | 'anchor-position'
  | 'entrance-position'
  | 'spawn-position';

export const StageSceneViewer: React.FC<StageSceneViewerProps> = ({
  stage,
  selection,
  camera,
  onSelect,
  onCameraChange,
  onChange,
  showGrid,
  previewAnimation,
  previewFrame = 0,
  onBeginEdit,
  fitRequest = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const preview = evaluateStageAnimation(stage, previewAnimation, previewFrame);
  const dragRef = useRef<{
    mode: 'none' | 'pan' | 'object';
    startX: number;
    startY: number;
    camera: CameraState;
    selection?: StageSelection;
    positions?: Vec2[] | Vec3[];
    handle?: DragHandle;
    values?: number[];
    sourceModel?: string;
  }>({ mode: 'none', startX: 0, startY: 0, camera });

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      const bounds = containerRef.current!.getBoundingClientRect();
      setSize({ w: bounds.width, h: bounds.height });
    };
    const observer = new ResizeObserver(update);
    observer.observe(containerRef.current);
    update();
    return () => observer.disconnect();
  }, []);

  const lastFitRef = useRef(Number.NaN);
  useEffect(() => {
    if (size.w <= 0 || size.h <= 0) return;
    if (lastFitRef.current === fitRequest) return;
    lastFitRef.current = fitRequest;
    onCameraChange(cameraForStageBounds(stageAuthoringBounds(stage), size.w, size.h));
  }, [fitRequest, onCameraChange, size.h, size.w, stage]);

  const originX = size.w * (0.5 + camera.x * 0.5);
  const originY = size.h * (0.5 + camera.y * 0.5);
  const toX = useCallback((x: number) => originX + x * camera.scale, [originX, camera.scale]);
  const toY = useCallback((y: number) => originY + y * camera.scale, [originY, camera.scale]);
  const worldAt = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = svgRef.current!.getBoundingClientRect();
      return {
        x: (clientX - bounds.left - originX) / camera.scale,
        y: (clientY - bounds.top - originY) / camera.scale,
      };
    },
    [originX, originY, camera.scale]
  );

  const snapshotPositions = (target: StageSelection): Vec2[] | Vec3[] => {
    switch (target.kind) {
      case 'stage': {
        return [];
      }
      case 'collision': {
        const item = stage.scene.collision?.find((value) => value.id === target.id);
        return item ? [[...item.from], [...item.to]] : [];
      }
      case 'model': {
        const item = stage.scene.models?.find((value) => value.id === target.id);
        return item ? [[...(item.position ?? [0, 0, 0])]] : [];
      }
      case 'pointLight': {
        const item = stage.scene.effects?.pointLights?.find((value) => value.id === target.id);
        if (item?.emissionSource) {
          const model = stage.scene.models?.find(
            (value) => value.id.trim() === item.emissionSource.model.trim()
          );
          const transform = model && stageSourceTransform(model);
          return transform
            ? [transform.forward(item.emissionSource.localPosition ?? [0, 0, 0])]
            : [];
        }
        return item ? [[...(item.position ?? [0, 0, 0])]] : [];
      }
      case 'fogVolume': {
        const item = stage.scene.effects?.fogVolumes?.find((value) => value.id === target.id);
        return item ? [[...(item.position ?? [0, 0, 0])]] : [];
      }
      case 'particleEmitter': {
        const item = stage.scene.effects?.particleEmitters?.find((value) => value.id === target.id);
        return item ? [[...(item.position ?? [0, 0, 0])]] : [];
      }
      default:
        return [];
    }
  };

  const moveSelection = (
    target: StageSelection,
    positions: Vec2[] | Vec3[],
    dx: number,
    dy: number,
    handle: DragHandle,
    values: number[]
  ) => {
    const move3 = (position: Vec3): Vec3 => [position[0] + dx, position[1] + dy, position[2]];
    switch (target.kind) {
      case 'stage': {
        const [index, x, y] = values;
        if (handle === 'blast-left') stage.blastLeft = index + dx;
        else if (handle === 'blast-top') stage.blastTop = index + dy;
        else if (handle === 'blast-right') stage.blastRight = index + dx;
        else if (handle === 'blast-bottom') stage.blastBottom = index + dy;
        const items =
          handle === 'anchor-position'
            ? stage.anchors
            : handle === 'entrance-position'
              ? stage.entrances
              : handle === 'spawn-position'
                ? stage.spawns
                : undefined;
        const item = items?.[index];
        if (item) {
          item.x = x + dx;
          item.y = y + dy;
        }
        break;
      }
      case 'collision': {
        const item = stage.scene.collision?.find((value) => value.id === target.id);
        if (item && positions.length === 2) {
          if (handle !== 'collision-to') {
            item.from = [(positions[0] as Vec2)[0] + dx, (positions[0] as Vec2)[1] + dy];
          }
          if (handle !== 'collision-from') {
            item.to = [(positions[1] as Vec2)[0] + dx, (positions[1] as Vec2)[1] + dy];
          }
        }
        break;
      }
      case 'model': {
        const item = stage.scene.models?.find((value) => value.id === target.id);
        if (item && handle === 'model-size') {
          item.size = [
            Math.max(0, values[0] + dx * Math.abs(stage.scaleX ?? 1)),
            Math.max(0, values[1] + dy * Math.abs(stage.scaleY ?? 1)),
            values[2],
          ];
        } else if (item && positions[0]) {
          const position = positions[0] as Vec3;
          item.position = [
            position[0] + dx * (stage.scaleX ?? 1),
            position[1] - dy * (stage.scaleY ?? 1),
            position[2],
          ];
        }
        break;
      }
      case 'pointLight': {
        const item = stage.scene.effects?.pointLights?.find((value) => value.id === target.id);
        if (
          item?.emissionSource &&
          handle === 'source-offset' &&
          positions[0] &&
          dragRef.current.sourceModel === item.emissionSource.model
        ) {
          const model = stage.scene.models?.find(
            (value) => value.id.trim() === item.emissionSource.model.trim()
          );
          const transform = model && stageSourceTransform(model);
          if (transform) {
            const start = positions[0] as Vec3;
            item.emissionSource.localPosition = transform.inverse([
              start[0] + dx * (stage.scaleX || 1),
              start[1] + dy * (stage.scaleY || 1),
              start[2],
            ]);
          }
        } else if (item && handle === 'light-range')
          item.range = Math.max(0.0001, values[0] + dx / 0.12);
        else if (item && handle === 'move' && !item.emissionSource && positions[0])
          item.position = move3(positions[0] as Vec3);
        break;
      }
      case 'fogVolume': {
        const item = stage.scene.effects?.fogVolumes?.find((value) => value.id === target.id);
        if (item && handle === 'fog-radius') item.radius = Math.max(0, values[0] + dx);
        else if (item && positions[0]) item.position = move3(positions[0] as Vec3);
        break;
      }
      case 'particleEmitter': {
        const item = stage.scene.effects?.particleEmitters?.find((value) => value.id === target.id);
        if (item && handle === 'emitter-size') {
          item.size = [Math.max(0, values[0] + dx), Math.max(0, values[1] + dy), values[2]];
        } else if (item && positions[0]) item.position = move3(positions[0] as Vec3);
        break;
      }
    }
  };

  const beginObjectDrag = (
    event: React.PointerEvent,
    target: StageSelection,
    handle: DragHandle = 'move',
    values: number[] = []
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    onBeginEdit?.();
    onSelect(target);
    if (
      target.kind === 'pointLight' &&
      handle === 'move' &&
      stage.scene.effects?.pointLights?.find((light) => light.id === target.id)?.emissionSource
    )
      return;
    const start = worldAt(event.clientX, event.clientY);
    dragRef.current = {
      mode: 'object',
      startX: start.x,
      startY: start.y,
      camera,
      selection: target,
      positions: snapshotPositions(target),
      handle,
      values,
      sourceModel:
        target.kind === 'pointLight'
          ? stage.scene.effects?.pointLights?.find((light) => light.id === target.id)
              ?.emissionSource?.model
          : undefined,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button === 0) onSelect({ kind: 'stage' });
    if (event.button !== 1 && event.button !== 2) return;
    dragRef.current = {
      mode: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      camera,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'pan') {
      onCameraChange({
        x: drag.camera.x + ((event.clientX - drag.startX) * 2) / Math.max(size.w, 1),
        y: drag.camera.y + ((event.clientY - drag.startY) * 2) / Math.max(size.h, 1),
      });
    } else if (drag.mode === 'object' && drag.selection && drag.positions) {
      const current = worldAt(event.clientX, event.clientY);
      moveSelection(
        drag.selection,
        drag.positions,
        current.x - drag.startX,
        current.y - drag.startY,
        drag.handle ?? 'move',
        drag.values ?? []
      );
      onChange();
    }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current.mode = 'none';
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    onCameraChange({ scale: Math.min(8, Math.max(0.1, camera.scale * factor)) });
  };

  const blastComplete =
    stage.blastLeft !== undefined &&
    stage.blastTop !== undefined &&
    stage.blastRight !== undefined &&
    stage.blastBottom !== undefined;

  return (
    <div className="stageCanvas" ref={containerRef}>
      <svg
        ref={svgRef}
        role="img"
        aria-label="Stage scene editor"
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <defs>
          <pattern
            id="stage-grid"
            width={50 * camera.scale}
            height={50 * camera.scale}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${50 * camera.scale} 0 L 0 0 0 ${50 * camera.scale}`}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1"
              strokeOpacity="0.12"
            />
          </pattern>
        </defs>
        {showGrid && <rect width="100%" height="100%" fill="url(#stage-grid)" />}
        <line x1={0} y1={originY} x2={size.w} y2={originY} stroke="rgba(255,255,255,.16)" />
        <line x1={originX} y1={0} x2={originX} y2={size.h} stroke="rgba(255,255,255,.16)" />
        {blastComplete && (
          <g>
            <rect
              x={toX(stage.blastLeft!)}
              y={toY(Math.min(stage.blastTop!, stage.blastBottom!))}
              width={Math.abs(stage.blastRight! - stage.blastLeft!) * camera.scale}
              height={Math.abs(stage.blastBottom! - stage.blastTop!) * camera.scale}
              fill="none"
              stroke="var(--hit)"
              strokeOpacity="0.5"
              strokeDasharray="8 5"
            />
            {selection.kind === 'stage' && (
              <>
                {[
                  {
                    handle: 'blast-left' as const,
                    x: stage.blastLeft!,
                    y: (stage.blastTop! + stage.blastBottom!) / 2,
                    value: stage.blastLeft!,
                  },
                  {
                    handle: 'blast-top' as const,
                    x: (stage.blastLeft! + stage.blastRight!) / 2,
                    y: stage.blastTop!,
                    value: stage.blastTop!,
                  },
                  {
                    handle: 'blast-right' as const,
                    x: stage.blastRight!,
                    y: (stage.blastTop! + stage.blastBottom!) / 2,
                    value: stage.blastRight!,
                  },
                  {
                    handle: 'blast-bottom' as const,
                    x: (stage.blastLeft! + stage.blastRight!) / 2,
                    y: stage.blastBottom!,
                    value: stage.blastBottom!,
                  },
                ].map((bound) => (
                  <circle
                    key={bound.handle}
                    cx={toX(bound.x)}
                    cy={toY(bound.y)}
                    r={6}
                    className="stageResizeHandle"
                    onPointerDown={(event) =>
                      beginObjectDrag(event, { kind: 'stage' }, bound.handle, [bound.value])
                    }
                  />
                ))}
              </>
            )}
          </g>
        )}
        {(stage.scene.models ?? []).map((model) => {
          const position =
            preview.models.get(model.id) ??
            stageModelDisplayPosition(stage, model.position ?? [0, 0, 0]);
          const dimensions = stageModelDisplayHalfExtents(stage, model);
          const active = selected(selection, 'model', model.id);
          const emissions = (
            stageMaterialSlots(stage, model).length ? stageMaterialSlots(stage, model) : ['']
          ).map(
            (slot) =>
              preview.materials.get(model.id)?.get(slot.trim()) ??
              stageAuthoredEmission(stage, model, slot)
          );
          const emission = emissions.sort(
            (a, b) =>
              Math.max(...b.emissive) * b.emissiveStrength -
              Math.max(...a.emissive) * a.emissiveStrength
          )[0];
          const emitting = Math.max(...emission.emissive) * emission.emissiveStrength > 0;
          const swatch = emitting
            ? emissionSwatch(emission.emissive, emission.emissiveStrength)
            : 'var(--accent)';
          return (
            <g
              key={model.id}
              data-model={model.id}
              data-emission-strength={emission.emissiveStrength}
              onPointerDown={(event) => beginObjectDrag(event, { kind: 'model', id: model.id })}
            >
              <rect
                x={toX(position[0] - dimensions[0])}
                y={toY(position[1] - dimensions[1])}
                width={Math.max(8, dimensions[0] * 2 * camera.scale)}
                height={Math.max(8, dimensions[1] * 2 * camera.scale)}
                fill={swatch}
                fillOpacity={
                  emitting
                    ? Math.min(
                        0.85,
                        0.18 +
                          Math.log2(
                            1 + Math.max(...emission.emissive) * emission.emissiveStrength
                          ) *
                            0.12
                      )
                    : active
                      ? 0.3
                      : 0.1
                }
                stroke={swatch}
                strokeOpacity={active ? 1 : 0.45}
              />
              <text x={toX(position[0]) + 5} y={toY(position[1]) - 6} className="stageObjectLabel">
                {model.id}
                {!model.primitive ? ' · imported mesh proxy' : ''}
                {emitting ? ` · emission ×${Number(emission.emissiveStrength.toFixed(2))}` : ''}
              </text>
              {active && model.size && (
                <rect
                  x={toX(position[0] + dimensions[0]) - 5}
                  y={toY(position[1] + dimensions[1]) - 5}
                  width={10}
                  height={10}
                  className="stageResizeHandle"
                  onPointerDown={(event) =>
                    beginObjectDrag(event, { kind: 'model', id: model.id }, 'model-size', [
                      Math.abs(model.size[0]),
                      Math.abs(model.size[1]),
                      Math.abs(model.size[2]),
                    ])
                  }
                />
              )}
            </g>
          );
        })}
        {(stage.scene.collision ?? []).map((collision) => {
          const previewCollision = preview.collision.get(collision.id);
          const from = previewCollision?.from ?? collision.from;
          const to = previewCollision?.to ?? collision.to;
          const active = selected(selection, 'collision', collision.id);
          return (
            <g
              key={collision.id}
              onPointerDown={(event) =>
                beginObjectDrag(event, { kind: 'collision', id: collision.id })
              }
            >
              <line
                x1={toX(from[0])}
                y1={toY(from[1])}
                x2={toX(to[0])}
                y2={toY(to[1])}
                stroke={active ? 'var(--accent-warm)' : 'var(--fg)'}
                strokeWidth={active ? 5 : 3}
                onPointerDown={(event) =>
                  beginObjectDrag(event, { kind: 'collision', id: collision.id })
                }
              />
              <circle
                cx={toX(from[0])}
                cy={toY(from[1])}
                r={active ? 6 : 4}
                fill="var(--accent-warm)"
                className="stageResizeHandle"
                onPointerDown={(event) =>
                  beginObjectDrag(event, { kind: 'collision', id: collision.id }, 'collision-from')
                }
              />
              <circle
                cx={toX(to[0])}
                cy={toY(to[1])}
                r={active ? 6 : 4}
                fill="var(--accent-warm)"
                className="stageResizeHandle"
                onPointerDown={(event) =>
                  beginObjectDrag(event, { kind: 'collision', id: collision.id }, 'collision-to')
                }
              />
            </g>
          );
        })}
        {(stage.scene.effects?.fogVolumes ?? []).map((volume) => {
          const position = volume.position ?? [0, 0, 0];
          const active = selected(selection, 'fogVolume', volume.id);
          const radius = volume.radius ?? 50;
          return (
            <g key={volume.id}>
              <circle
                cx={toX(position[0])}
                cy={toY(position[1])}
                r={Math.max(6, radius * camera.scale)}
                fill="var(--accent-warm)"
                fillOpacity={active ? 0.2 : 0.08}
                stroke="var(--accent-warm)"
                strokeOpacity={active ? 1 : 0.45}
                pointerEvents="stroke"
                onPointerDown={(event) =>
                  beginObjectDrag(event, { kind: 'fogVolume', id: volume.id })
                }
              />
              {active && (
                <circle
                  cx={toX(position[0] + radius)}
                  cy={toY(position[1])}
                  r={6}
                  className="stageResizeHandle"
                  onPointerDown={(event) =>
                    beginObjectDrag(event, { kind: 'fogVolume', id: volume.id }, 'fog-radius', [
                      radius,
                    ])
                  }
                />
              )}
            </g>
          );
        })}
        {(stage.scene.effects?.particleEmitters ?? []).map((emitter) => {
          const position = emitter.position ?? [0, 0, 0];
          const dimensions = emitter.size ?? [20, 20, 20];
          const active = selected(selection, 'particleEmitter', emitter.id);
          const common = {
            fill: 'var(--hit)',
            fillOpacity: active ? 0.2 : 0.08,
            stroke: 'var(--hit)',
            strokeOpacity: active ? 1 : 0.5,
            pointerEvents: 'stroke' as const,
            onPointerDown: (event: React.PointerEvent) =>
              beginObjectDrag(event, { kind: 'particleEmitter', id: emitter.id }),
          };
          return (
            <g key={emitter.id}>
              {emitter.shape === 'ellipsoid' ? (
                <ellipse
                  cx={toX(position[0])}
                  cy={toY(position[1])}
                  rx={Math.max(6, dimensions[0] * camera.scale)}
                  ry={Math.max(6, dimensions[1] * camera.scale)}
                  {...common}
                />
              ) : (
                <rect
                  x={toX(position[0] - dimensions[0])}
                  y={toY(position[1] - dimensions[1])}
                  width={Math.max(8, dimensions[0] * 2 * camera.scale)}
                  height={Math.max(8, dimensions[1] * 2 * camera.scale)}
                  {...common}
                />
              )}
              {active && (
                <rect
                  x={toX(position[0] + dimensions[0]) - 5}
                  y={toY(position[1] + dimensions[1]) - 5}
                  width={10}
                  height={10}
                  className="stageResizeHandle"
                  onPointerDown={(event) =>
                    beginObjectDrag(
                      event,
                      { kind: 'particleEmitter', id: emitter.id },
                      'emitter-size',
                      [...dimensions]
                    )
                  }
                />
              )}
            </g>
          );
        })}
        {(stage.scene.effects?.pointLights ?? []).map((light) => {
          const source = light.emissionSource;
          const model =
            source && stage.scene.models?.find((item) => item.id.trim() === source.model.trim());
          const transform = model && stageSourceTransform(model);
          const world = transform?.forward(source?.localPosition ?? [0, 0, 0]);
          const base = model && stageModelDisplayPosition(stage, model.position ?? [0, 0, 0]);
          const animated = model && preview.models.get(model.id);
          const position = source
            ? world
              ? [
                  world[0] / (stage.scaleX || 1) + (animated ? animated[0] - base[0] : 0),
                  world[1] / (stage.scaleY || 1) + (animated ? animated[1] - base[1] : 0),
                  world[2],
                ]
              : (animated ?? base)
            : (light.position ?? [0, 0, 0]);
          if (!position) return null;
          const emission =
            model && source
              ? (preview.materials.get(model.id)?.get(source.materialSlot.trim()) ??
                stageAuthoredEmission(stage, model, source.materialSlot))
              : undefined;
          const color = emission
            ? emissionSwatch(emission.emissive, emission.emissiveStrength)
            : emissionSwatch(light.color ?? [1, 1, 1], 1);
          const energy =
            (light.intensity ?? 1) *
            (emission ? emission.emissiveStrength * Math.max(...emission.emissive) : 1);
          const opacity = Math.min(0.4, 0.04 + Math.log2(1 + Math.max(0, energy)) * 0.025);
          const active = selected(selection, 'pointLight', light.id);
          const displayRadius = Math.max(
            10,
            Math.min(80, (light.range ?? 100) * camera.scale * 0.12)
          );
          return (
            <g
              key={light.id}
              data-light={light.id}
              data-source-proxy={!!source && !transform}
              onPointerDown={(event) =>
                source && !transform
                  ? (event.stopPropagation(), onSelect({ kind: 'pointLight', id: light.id }))
                  : beginObjectDrag(
                      event,
                      { kind: 'pointLight', id: light.id },
                      source ? 'source-offset' : 'move'
                    )
              }
            >
              <circle
                cx={toX(position[0])}
                cy={toY(position[1])}
                r={displayRadius}
                fill={color}
                fillOpacity={opacity}
                stroke={color}
                strokeDasharray={source && !transform ? '4 4' : undefined}
                strokeOpacity={active ? 1 : 0.45}
                pointerEvents="stroke"
              />
              <circle
                cx={toX(position[0])}
                cy={toY(position[1])}
                r={5}
                fill={color}
                stroke="var(--accent-warm)"
                aria-label={source ? `Attached offset for ${light.id}` : `Light ${light.id}`}
              />
              <title>
                {source
                  ? `${light.id}: ${source.model} / ${source.materialSlot}. ${transform ? 'Attached local-offset handle' : 'Attachment proxy at model origin; exact mesh transform unavailable'}`
                  : light.id}
              </title>
              {source && (
                <text
                  x={toX(position[0]) + 9}
                  y={toY(position[1]) + 13}
                  className="stageObjectLabel"
                  pointerEvents="none"
                >
                  {transform ? 'attached offset' : 'attachment proxy'}
                </text>
              )}
              {active && (
                <circle
                  cx={toX(position[0]) + displayRadius}
                  cy={toY(position[1])}
                  r={6}
                  className="stageResizeHandle"
                  onPointerDown={(event) =>
                    beginObjectDrag(event, { kind: 'pointLight', id: light.id }, 'light-range', [
                      light.range ?? 100,
                    ])
                  }
                />
              )}
            </g>
          );
        })}
        {stage.anchors.map((anchor, index) => (
          <text
            key={`anchor-${index}`}
            x={toX(anchor.x)}
            y={toY(anchor.y)}
            className="stageAnchorMarker"
            pointerEvents="all"
            onPointerDown={(event) =>
              beginObjectDrag(event, { kind: 'stage' }, 'anchor-position', [
                index,
                anchor.x,
                anchor.y,
              ])
            }
          >
            ◇
          </text>
        ))}
        {stage.entrances.map((entrance, index) => (
          <text
            key={`entrance-${index}`}
            x={toX(entrance.x)}
            y={toY(entrance.y)}
            className="stageEntranceMarker"
            pointerEvents="all"
            onPointerDown={(event) =>
              beginObjectDrag(event, { kind: 'stage' }, 'entrance-position', [
                index,
                entrance.x,
                entrance.y,
              ])
            }
          >
            {entrance.face ? '▷' : '◁'}
          </text>
        ))}
        {stage.spawns.map((spawn, index) => (
          <text
            key={`spawn-${index}`}
            x={toX(spawn.x)}
            y={toY(spawn.y)}
            className="stageSpawnMarker"
            pointerEvents="all"
            onPointerDown={(event) =>
              beginObjectDrag(event, { kind: 'stage' }, 'spawn-position', [index, spawn.x, spawn.y])
            }
          >
            {spawn.face ? '▶' : '◀'}
          </text>
        ))}
      </svg>
      <div className="stageViewerLegend">
        SVG authoring proxy · emission swatches and source markers · no PBR shading or bloom
      </div>
    </div>
  );
};
