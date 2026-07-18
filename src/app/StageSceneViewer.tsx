import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CameraState } from '../animator/context/AnimatorContext';
import { evaluateStageAnimation } from '../stage/animation';
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
}

const selected = (selection: StageSelection, kind: StageSelection['kind'], id: string) =>
  selection.kind === kind && selection.id === id;

type DragHandle =
  | 'move'
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const preview = useMemo(
    () => evaluateStageAnimation(stage, previewAnimation, previewFrame),
    [stage, previewAnimation, previewFrame]
  );
  const dragRef = useRef<{
    mode: 'none' | 'pan' | 'object';
    startX: number;
    startY: number;
    camera: CameraState;
    selection?: StageSelection;
    positions?: Vec2[] | Vec3[];
    handle?: DragHandle;
    values?: number[];
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

  const originX = size.w * (0.5 + camera.x * 0.5);
  const originY = size.h * (0.5 + camera.y * 0.5);
  const toX = useCallback((x: number) => originX + x * camera.scale, [originX, camera.scale]);
  const toY = useCallback((y: number) => originY - y * camera.scale, [originY, camera.scale]);
  const worldAt = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = svgRef.current!.getBoundingClientRect();
      return {
        x: (clientX - bounds.left - originX) / camera.scale,
        y: -(clientY - bounds.top - originY) / camera.scale,
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
          item.size = [Math.max(0, values[0] + dx * 2), Math.max(0, values[1] + dy * 2), values[2]];
        } else if (item && positions[0]) item.position = move3(positions[0] as Vec3);
        break;
      }
      case 'pointLight': {
        const item = stage.scene.effects?.pointLights?.find((value) => value.id === target.id);
        if (item && handle === 'light-range') item.range = Math.max(0, values[0] + dx / 0.12);
        else if (item && positions[0]) item.position = move3(positions[0] as Vec3);
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
              stroke="rgba(106,169,255,.12)"
              strokeWidth="1"
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
              y={toY(stage.blastTop!)}
              width={(stage.blastRight! - stage.blastLeft!) * camera.scale}
              height={(stage.blastTop! - stage.blastBottom!) * camera.scale}
              fill="none"
              stroke="rgba(240,100,100,.5)"
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
          const position = preview.models.get(model.id) ?? model.position ?? [0, 0, 0];
          const dimensions = model.size ?? model.scale ?? [30, 30, 30];
          const active = selected(selection, 'model', model.id);
          return (
            <g
              key={model.id}
              onPointerDown={(event) => beginObjectDrag(event, { kind: 'model', id: model.id })}
            >
              <rect
                x={toX(position[0] - Math.abs(dimensions[0]) / 2)}
                y={toY(position[1] + Math.abs(dimensions[1]) / 2)}
                width={Math.max(8, Math.abs(dimensions[0]) * camera.scale)}
                height={Math.max(8, Math.abs(dimensions[1]) * camera.scale)}
                fill={active ? 'rgba(106,169,255,.3)' : 'rgba(106,169,255,.1)'}
                stroke={active ? '#6aa9ff' : 'rgba(106,169,255,.45)'}
              />
              <text x={toX(position[0]) + 5} y={toY(position[1]) - 6} className="stageObjectLabel">
                {model.id}
              </text>
              {active && model.size && (
                <rect
                  x={toX(position[0] + Math.abs(dimensions[0]) / 2) - 5}
                  y={toY(position[1] + Math.abs(dimensions[1]) / 2) - 5}
                  width={10}
                  height={10}
                  className="stageResizeHandle"
                  onPointerDown={(event) =>
                    beginObjectDrag(event, { kind: 'model', id: model.id }, 'model-size', [
                      Math.abs(dimensions[0]),
                      Math.abs(dimensions[1]),
                      Math.abs(dimensions[2]),
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
                stroke={active ? '#ffcc66' : '#e6eaf2'}
                strokeWidth={active ? 5 : 3}
                onPointerDown={(event) =>
                  beginObjectDrag(event, { kind: 'collision', id: collision.id })
                }
              />
              <circle
                cx={toX(from[0])}
                cy={toY(from[1])}
                r={active ? 6 : 4}
                fill="#ffcc66"
                className="stageResizeHandle"
                onPointerDown={(event) =>
                  beginObjectDrag(event, { kind: 'collision', id: collision.id }, 'collision-from')
                }
              />
              <circle
                cx={toX(to[0])}
                cy={toY(to[1])}
                r={active ? 6 : 4}
                fill="#ffcc66"
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
                fill={active ? 'rgba(150,180,220,.2)' : 'rgba(150,180,220,.08)'}
                stroke={active ? '#a8c8ff' : 'rgba(168,200,255,.45)'}
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
            fill: active ? 'rgba(176,106,255,.2)' : 'rgba(176,106,255,.08)',
            stroke: active ? '#c98cff' : 'rgba(201,140,255,.5)',
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
                  y={toY(position[1] + dimensions[1])}
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
          const position = light.position ?? [0, 0, 0];
          const active = selected(selection, 'pointLight', light.id);
          const displayRadius = Math.max(
            10,
            Math.min(80, (light.range ?? 100) * camera.scale * 0.12)
          );
          return (
            <g
              key={light.id}
              onPointerDown={(event) =>
                beginObjectDrag(event, { kind: 'pointLight', id: light.id })
              }
            >
              <circle
                cx={toX(position[0])}
                cy={toY(position[1])}
                r={displayRadius}
                fill={active ? 'rgba(255,220,100,.2)' : 'rgba(255,220,100,.07)'}
                stroke={active ? '#ffdc64' : 'rgba(255,220,100,.45)'}
                pointerEvents="stroke"
              />
              <circle cx={toX(position[0])} cy={toY(position[1])} r={5} fill="#ffdc64" />
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
        collision · models · lights · fog · particles · spawns
      </div>
    </div>
  );
};
