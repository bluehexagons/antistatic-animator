/**
 * StageViewer — the central animation viewer.
 *
 * Renders the character's hurtbubbles and the current keyframe's hitbubbles
 * to an SVG that fills the stage area. Supports:
 *  - mouse-wheel zoom around the cursor
 *  - middle/right drag to pan
 *  - left-click to select a bubble (hurtbubble or hitbubble)
 *  - left-drag a selected hurtbubble to move it
 *  - left-drag empty space to marquee-select hurtbubbles; shift-click to
 *    toggle members; drag/nudge the group together
 *  - a grid + ground reference line
 *  - hurtbubble tint by HurtbubbleState (armor/intangible/etc.)
 *  - hitbubble tint by HitbubbleType + smear trails + knockback gizmo
 *  - z-axis tinting (front warmer / back cooler) using bone.z
 *  - onion-skin ghosts, bone-name labels, and a shield overlay
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Animation, EntityData, Hitbubble } from '../animator/types';
import { objHas } from '../utils';
import { bubbleLabels } from '../animator/rendering/character-info';
import type { CameraState } from '../animator/context/AnimatorContext';
import { HitbubbleColors, HurtbubbleStateById, HurtbubbleStateId } from '../animator/schema';
import { interpolatedPose } from '../animator/operations/interpolate';
import { HURTBUBBLE_MODEL_TRANSFORM_FIELDS } from '../animator/operations/model-transforms';
import {
  interpolatedModelTransformFrame,
  modelTransformDefaults,
} from '../animator/operations/model-transform-timeline';
import { getCapsulePoints, resolveHitbubble, zTint } from './stage/stage-utils';
import { KnockbackGizmo } from './stage/KnockbackGizmo';

export interface StageViewerProps {
  character: EntityData;
  animation: Animation;
  keyframe: number;
  /** Sub-keyframe progress in frames; used to lerp the displayed pose
   *  when the keyframe has `interpolate: true`. */
  tick: number;
  camera: CameraState;
  selectedBubble: number;
  onSelectBubble: (i: number) => void;
  selectedHitbubble: number;
  onSelectHitbubble: (i: number) => void;
  onCameraChange: (cam: Partial<CameraState>) => void;
  onBubbleChange: () => void;
  showGrid: boolean;
  showGround: boolean;
  showHitboxes: boolean;
  showOnion: boolean;
  showLabels: boolean;
  showShield: boolean;
}

interface Size {
  w: number;
  h: number;
}

export const StageViewer: React.FC<StageViewerProps> = ({
  character,
  animation,
  keyframe,
  tick,
  camera,
  selectedBubble,
  onSelectBubble,
  selectedHitbubble,
  onSelectHitbubble,
  onCameraChange,
  onBubbleChange,
  showGrid,
  showGround,
  showHitboxes,
  showOnion,
  showLabels,
  showShield,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredBubble, setHoveredBubble] = useState(-1);
  /** Marquee-selected hurtbubble indices (group). The single `selectedBubble`
   *  drives the inspector; this drives group drag / nudge in the viewer. */
  const [groupSel, setGroupSel] = useState<Set<number>>(new Set());
  /** Live marquee rectangle in screen px while dragging, else null. */
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>({ w: 800, h: 600 });
  const dragRef = useRef<{
    mode: 'pan' | 'move-bubble' | 'group-move' | 'marquee' | 'none';
    startClientX: number;
    startClientY: number;
    startCam: CameraState;
    startBubble?: { x: number; y: number; index: number };
    /** Snapshot of group member positions for group-move. */
    groupStart?: { index: number; x: number; y: number }[];
    /** Marquee origin in screen px; `additive` unions with the prior set. */
    marqueeStart?: { px: number; py: number; additive: boolean };
  }>({ mode: 'none', startClientX: 0, startClientY: 0, startCam: camera });

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      const r = containerRef.current!.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(containerRef.current);
    const r = containerRef.current.getBoundingClientRect();
    setSize({ w: r.width, h: r.height });
    return () => ro.disconnect();
  }, []);

  // Drop the group selection when the edited keyframe or animation changes —
  // indices would otherwise point at a different pose. Keyed on the keyframes
  // array (stable across in-place edits) so an edit doesn't clear the group
  // mid-drag / mid-nudge.
  useEffect(() => {
    setGroupSel(new Set());
    setMarquee(null);
  }, [keyframe, animation.keyframes]);

  const { w, h } = size;
  const ox = w * (0.5 + camera.x * 0.5);
  const oy = h * (0.5 + camera.y * 0.5);

  const toSvgX = useCallback((wx: number) => wx * camera.scale + ox, [camera.scale, ox]);
  const toSvgY = useCallback((wy: number) => -wy * camera.scale + oy, [camera.scale, oy]);

  const fromSvg = useCallback(
    (px: number, py: number) => ({
      x: (px - ox) / camera.scale,
      y: -(py - oy) / camera.scale,
    }),
    [camera.scale, ox, oy]
  );

  const kf = animation.keyframes[keyframe];
  /** Authoritative pose for editing operations (drag, pick). */
  const hurtbubbles = kf?.hurtbubbles && Array.isArray(kf.hurtbubbles) ? kf.hurtbubbles : null;
  /** Displayed pose, possibly interpolated toward the next keyframe. */
  const displayPose = useMemo(
    () => interpolatedPose(animation, keyframe, tick),
    [animation, keyframe, tick]
  );
  const modelTransforms = useMemo(
    () => interpolatedModelTransformFrame(animation, character, keyframe, tick),
    [animation, character, keyframe, tick]
  );
  const modelDefaults = useMemo(() => modelTransformDefaults(character), [character]);

  const hitbubbles = useMemo<Hitbubble[] | null>(() => {
    if (!kf || !objHas(kf, 'hitbubbles')) return null;
    let cur = kf;
    let i = keyframe;
    while (cur?.hitbubbles === true) {
      i--;
      cur = animation.keyframes[i];
    }
    return Array.isArray(cur?.hitbubbles) ? cur.hitbubbles : null;
  }, [kf, keyframe, animation.keyframes]);

  // Group nudge: arrows/WASD move every group member. Only active for multi-
  // selections so it doesn't double up with BubbleEditor's single-bubble nudge.
  useEffect(() => {
    if (groupSel.size <= 1 || !hurtbubbles) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const step = e.shiftKey ? 5 : e.altKey ? 0.1 : 1;
      let dx = 0;
      let dy = 0;
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          dy = step;
          break;
        case 'arrowdown':
        case 's':
          dy = -step;
          break;
        case 'arrowleft':
        case 'a':
          dx = -step;
          break;
        case 'arrowright':
        case 'd':
          dx = step;
          break;
        default:
          return;
      }
      e.preventDefault();
      for (const idx of groupSel) {
        hurtbubbles[idx * 4] = (hurtbubbles[idx * 4] ?? 0) + dx;
        hurtbubbles[idx * 4 + 1] = (hurtbubbles[idx * 4 + 1] ?? 0) + dy;
      }
      onBubbleChange();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [groupSel, hurtbubbles, onBubbleChange]);

  const pickBubbleAt = useCallback(
    (worldX: number, worldY: number): number => {
      if (!hurtbubbles) return -1;
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < hurtbubbles.length; i += 4) {
        const bx = hurtbubbles[i];
        const by = hurtbubbles[i + 1];
        const br = hurtbubbles[i + 2];
        const d2 = (worldX - bx) ** 2 + (worldY - by) ** 2;
        if (d2 <= br * br && d2 < bestDist) {
          bestDist = d2;
          best = i / 4;
        }
      }
      return best;
    },
    [hurtbubbles]
  );

  const pickHitbubbleAt = useCallback(
    (worldX: number, worldY: number): number => {
      if (!showHitboxes || !hitbubbles) return -1;
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < hitbubbles.length; i++) {
        const resolved = resolveHitbubble(hitbubbles[i], character, hurtbubbles);
        const r = hitbubbles[i].radius ?? 0;
        const d2 = (worldX - resolved.x) ** 2 + (worldY - resolved.y) ** 2;
        if (d2 <= r * r && d2 < bestDist) {
          bestDist = d2;
          best = i;
        }
      }
      return best;
    },
    [hitbubbles, character, hurtbubbles, showHitboxes]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { x: wx, y: wy } = fromSvg(px, py);

    if (e.button === 0) {
      const hitIdx = pickHitbubbleAt(wx, wy);
      const found = pickBubbleAt(wx, wy);
      // Hurtbubble click takes precedence (since they're usually behind hitbubbles
      // visually but represent the editable rig).
      if (found >= 0 && hurtbubbles) {
        if (e.shiftKey) {
          // Toggle membership in the group selection; no drag.
          const next = new Set(groupSel);
          if (next.has(found)) next.delete(found);
          else next.add(found);
          setGroupSel(next);
          onSelectHitbubble(-1);
          // Keep the inspector pointed at a single member only; for a real
          // group (>1) clear it so single-bubble nudge stays inert and the
          // group nudge isn't double-applied to the clicked bubble.
          onSelectBubble(next.size === 1 ? [...next][0] : -1);
          return;
        }
        onSelectHitbubble(-1);
        svgRef.current.setPointerCapture(e.pointerId);
        if (groupSel.has(found) && groupSel.size > 1 && hurtbubbles) {
          // Drag the whole group. Keep selectedBubble cleared so a later
          // keyboard nudge drives the group handler only (not also the
          // single-bubble one).
          onSelectBubble(-1);
          dragRef.current = {
            mode: 'group-move',
            startClientX: e.clientX,
            startClientY: e.clientY,
            startCam: camera,
            groupStart: [...groupSel].map((index) => ({
              index,
              x: hurtbubbles[index * 4],
              y: hurtbubbles[index * 4 + 1],
            })),
          };
        } else {
          setGroupSel(new Set());
          onSelectBubble(found);
          dragRef.current = {
            mode: 'move-bubble',
            startClientX: e.clientX,
            startClientY: e.clientY,
            startCam: camera,
            startBubble: {
              index: found,
              x: hurtbubbles[found * 4],
              y: hurtbubbles[found * 4 + 1],
            },
          };
        }
      } else if (hitIdx >= 0) {
        onSelectHitbubble(hitIdx);
        onSelectBubble(-1);
        setGroupSel(new Set());
      } else {
        // Empty space: start a marquee selection.
        svgRef.current.setPointerCapture(e.pointerId);
        dragRef.current = {
          mode: 'marquee',
          startClientX: e.clientX,
          startClientY: e.clientY,
          startCam: camera,
          marqueeStart: { px, py, additive: e.shiftKey },
        };
        setMarquee({ x1: px, y1: py, x2: px, y2: py });
      }
    } else if (e.button === 1 || e.button === 2) {
      svgRef.current.setPointerCapture(e.pointerId);
      dragRef.current = {
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCam: camera,
      };
      e.preventDefault();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'pan') {
      const dx = (e.clientX - drag.startClientX) / (w * 0.5);
      const dy = (e.clientY - drag.startClientY) / (h * 0.5);
      onCameraChange({
        x: drag.startCam.x + dx,
        y: drag.startCam.y + dy,
      });
    } else if (drag.mode === 'move-bubble' && drag.startBubble && hurtbubbles) {
      const dx = (e.clientX - drag.startClientX) / camera.scale;
      const dy = -(e.clientY - drag.startClientY) / camera.scale;
      const base = drag.startBubble.index * 4;
      hurtbubbles[base] = drag.startBubble.x + dx;
      hurtbubbles[base + 1] = drag.startBubble.y + dy;
      onBubbleChange();
    } else if (drag.mode === 'group-move' && drag.groupStart && hurtbubbles) {
      const dx = (e.clientX - drag.startClientX) / camera.scale;
      const dy = -(e.clientY - drag.startClientY) / camera.scale;
      for (const g of drag.groupStart) {
        hurtbubbles[g.index * 4] = g.x + dx;
        hurtbubbles[g.index * 4 + 1] = g.y + dy;
      }
      onBubbleChange();
    } else if (drag.mode === 'marquee' && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setMarquee({
        x1: drag.marqueeStart!.px,
        y1: drag.marqueeStart!.py,
        x2: e.clientX - rect.left,
        y2: e.clientY - rect.top,
      });
    } else if (drag.mode === 'none' && svgRef.current) {
      // Track hover so labels can surface the bubble under the cursor.
      const rect = svgRef.current.getBoundingClientRect();
      const { x: wx, y: wy } = fromSvg(e.clientX - rect.left, e.clientY - rect.top);
      const found = pickBubbleAt(wx, wy);
      setHoveredBubble((prev) => (prev === found ? prev : found));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (drag.mode === 'marquee' && drag.marqueeStart) {
      const x1w = fromSvg(drag.marqueeStart.px, drag.marqueeStart.py);
      const rect = svgRef.current?.getBoundingClientRect();
      const px2 = rect ? e.clientX - rect.left : drag.marqueeStart.px;
      const py2 = rect ? e.clientY - rect.top : drag.marqueeStart.py;
      const x2w = fromSvg(px2, py2);
      const dragDist = Math.hypot(px2 - drag.marqueeStart.px, py2 - drag.marqueeStart.py);
      const minX = Math.min(x1w.x, x2w.x);
      const maxX = Math.max(x1w.x, x2w.x);
      const minY = Math.min(x1w.y, x2w.y);
      const maxY = Math.max(x1w.y, x2w.y);
      if (dragDist < 4) {
        // Treat a click (no real drag) as deselect.
        if (!drag.marqueeStart.additive) {
          setGroupSel(new Set());
          onSelectBubble(-1);
        }
      } else if (hurtbubbles) {
        const picked = new Set<number>(drag.marqueeStart.additive ? groupSel : []);
        for (let i = 0; i < hurtbubbles.length; i += 4) {
          const bx = hurtbubbles[i];
          const by = hurtbubbles[i + 1];
          if (bx >= minX && bx <= maxX && by >= minY && by <= maxY) picked.add(i / 4);
        }
        setGroupSel(picked);
        // Point the inspector at one member so single-bubble nudge stays inert.
        onSelectBubble(picked.size === 1 ? [...picked][0] : -1);
      }
      setMarquee(null);
    }
    if (drag.mode !== 'none') {
      svgRef.current?.releasePointerCapture(e.pointerId);
      dragRef.current = {
        mode: 'none',
        startClientX: 0,
        startClientY: 0,
        startCam: camera,
      };
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const before = fromSvg(px, py);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const newScale = Math.max(0.25, Math.min(40, camera.scale * factor));

    const newOx = px - before.x * newScale;
    const newOy = py + before.y * newScale;
    const newCx = (newOx / w - 0.5) * 2;
    const newCy = (newOy / h - 0.5) * 2;
    onCameraChange({ x: newCx, y: newCy, scale: newScale });
  };

  const onContextMenu = (e: React.MouseEvent) => e.preventDefault();

  // --- Grid -----------------------------------------------------
  const gridLines: React.ReactNode[] = [];
  if (showGrid) {
    const step = camera.scale;
    const major = 5;
    const minStep = Math.max(8, step);
    const startX = -Math.floor(ox / minStep) - 1;
    const endX = Math.floor((w - ox) / minStep) + 1;
    const startY = -Math.floor(oy / minStep) - 1;
    const endY = Math.floor((h - oy) / minStep) + 1;
    for (let i = startX; i <= endX; i++) {
      const x = ox + i * minStep;
      gridLines.push(
        <line
          key={`gx${i}`}
          x1={x}
          y1={0}
          x2={x}
          y2={h}
          stroke={i === 0 ? '#3d475a' : i % major === 0 ? '#252b36' : '#1d2129'}
          strokeWidth={i === 0 ? 1 : 0.5}
        />
      );
    }
    for (let i = startY; i <= endY; i++) {
      const y = oy + i * minStep;
      gridLines.push(
        <line
          key={`gy${i}`}
          x1={0}
          y1={y}
          x2={w}
          y2={y}
          stroke={i === 0 ? '#3d475a' : i % major === 0 ? '#252b36' : '#1d2129'}
          strokeWidth={i === 0 ? 1 : 0.5}
        />
      );
    }
  }

  // --- Hurtbubble rendering, state-coloured --------------------
  const bones = character.hurtbubbles;
  const renderHurtbubbles = () => {
    const pose = displayPose ?? hurtbubbles;
    if (!pose) return null;
    // Sort bones by z so back ones draw first.
    const order = bones.map((b, i) => ({ b, i })).sort((a, b) => (a.b.z ?? 0) - (b.b.z ?? 0));
    return order.map(({ b: bone, i: idx }) => {
      const i1 = bone.i1 * 4;
      const i2 = bone.i2 * 4;
      if (i1 >= pose.length || i2 >= pose.length) return null;
      const x1 = toSvgX(pose[i1]);
      const y1 = toSvgY(pose[i1 + 1]);
      const x2 = toSvgX(pose[i2]);
      const y2 = toSvgY(pose[i2 + 1]);
      const r = pose[i1 + 2] * camera.scale;
      const state = HurtbubbleStateById.get(pose[i1 + 3] as HurtbubbleStateId);
      const z = zTint(bone.z);
      // If this bone has a non-normal state, override the fill with the state color.
      const useState = state && state.id !== 1 && state.id !== 0;
      const fill = useState ? state!.color + '55' : z.fill;
      const stroke = useState ? state!.color : z.stroke;
      return (
        <polygon
          key={`bone-${idx}`}
          points={getCapsulePoints(x1, y1, x2, y2, r)}
          fill={fill}
          stroke={stroke}
          strokeWidth={0.75}
        />
      );
    });
  };

  const renderModelTransforms = () => {
    const pose = displayPose ?? hurtbubbles;
    if (!pose) return null;

    const activeModelTransforms = modelTransforms ?? modelDefaults;

    return bones.map((bone, idx) => {
      const offset = idx * HURTBUBBLE_MODEL_TRANSFORM_FIELDS;
      const i1 = bone.i1 * 4;
      const i2 = bone.i2 * 4;
      if (i1 >= pose.length || i2 >= pose.length || offset + 2 >= activeModelTransforms.length) {
        return null;
      }

      const hasModel = Array.isArray(bone.prefab?.models) && bone.prefab.models.length > 0;
      const changed =
        activeModelTransforms[offset] !== (modelDefaults[offset] ?? 0) ||
        activeModelTransforms[offset + 1] !== (modelDefaults[offset + 1] ?? 0) ||
        activeModelTransforms[offset + 2] !== (modelDefaults[offset + 2] ?? 0);
      if (!hasModel && !changed) return null;

      const cx = (pose[i1] + pose[i2]) * 0.5;
      const cy = (pose[i1 + 1] + pose[i2 + 1]) * 0.5;
      const vx = cx + activeModelTransforms[offset];
      const vy = cy + activeModelTransforms[offset + 1];
      const radius = Math.max(pose[i1 + 2] ?? 4, 4);
      const axisLength = radius * 0.9;
      const radians = ((activeModelTransforms[offset + 2] ?? 0) * Math.PI) / 180;
      const xAxisX = vx + Math.cos(radians) * axisLength;
      const xAxisY = vy + Math.sin(radians) * axisLength;
      const yAxisX = vx + Math.cos(radians + Math.PI / 2) * axisLength * 0.7;
      const yAxisY = vy + Math.sin(radians + Math.PI / 2) * axisLength * 0.7;
      const selected = selectedBubble === bone.i1 || selectedBubble === bone.i2;
      const opacity = selected ? 0.95 : changed ? 0.75 : 0.45;
      const title = `${bone.name}: model offset (${activeModelTransforms[offset].toFixed(2)}, ${(-activeModelTransforms[offset + 1]).toFixed(2)}), rotation ${activeModelTransforms[offset + 2].toFixed(2)} deg`;

      return (
        <g key={`model-transform-${idx}`} pointerEvents="none" opacity={opacity}>
          <title>{title}</title>
          <line
            x1={toSvgX(cx)}
            y1={toSvgY(cy)}
            x2={toSvgX(vx)}
            y2={toSvgY(vy)}
            stroke="#f6c85f"
            strokeWidth={selected ? 1.5 : 1}
            strokeDasharray="3 2"
          />
          <circle
            cx={toSvgX(vx)}
            cy={toSvgY(vy)}
            r={Math.max(3, camera.scale * 0.12)}
            fill="#f6c85f"
            stroke="#11151d"
            strokeWidth="0.75"
          />
          <line
            x1={toSvgX(vx)}
            y1={toSvgY(vy)}
            x2={toSvgX(xAxisX)}
            y2={toSvgY(xAxisY)}
            stroke="#ff6b6b"
            strokeWidth={selected ? 1.6 : 1.1}
          />
          <line
            x1={toSvgX(vx)}
            y1={toSvgY(vy)}
            x2={toSvgX(yAxisX)}
            y2={toSvgY(yAxisY)}
            stroke="#6aa9ff"
            strokeWidth={selected ? 1.4 : 1}
          />
        </g>
      );
    });
  };

  // --- Onion-skin: faded ghosts of the neighbouring keyframes ---
  const renderPoseGhost = (pose: number[], color: string, keyPrefix: string) => {
    return bones.map((bone, idx) => {
      const i1 = bone.i1 * 4;
      const i2 = bone.i2 * 4;
      if (i1 >= pose.length || i2 >= pose.length) return null;
      const x1 = toSvgX(pose[i1]);
      const y1 = toSvgY(pose[i1 + 1]);
      const x2 = toSvgX(pose[i2]);
      const y2 = toSvgY(pose[i2 + 1]);
      const r = pose[i1 + 2] * camera.scale;
      return (
        <polygon
          key={`${keyPrefix}-${idx}`}
          points={getCapsulePoints(x1, y1, x2, y2, r)}
          fill="none"
          stroke={color}
          strokeWidth={0.75}
          opacity={0.4}
        />
      );
    });
  };

  const renderOnionSkin = () => {
    if (!showOnion) return null;
    const ghosts: React.ReactNode[] = [];
    const prev = animation.keyframes[keyframe - 1]?.hurtbubbles;
    const next = animation.keyframes[keyframe + 1]?.hurtbubbles;
    if (Array.isArray(prev)) {
      ghosts.push(<g key="onion-prev">{renderPoseGhost(prev, '#ff8a4a', 'prev')}</g>);
    }
    if (Array.isArray(next)) {
      ghosts.push(<g key="onion-next">{renderPoseGhost(next, '#6aa9ff', 'next')}</g>);
    }
    return ghosts;
  };

  // --- Shield overlay: capsule from (shieldX,Y) to (shieldX2,Y2) -
  const renderShield = () => {
    if (!showShield) return null;
    const num = (k: string): number | undefined => {
      const v = (character as Record<string, unknown>)[k];
      return typeof v === 'number' ? v : undefined;
    };
    const sx = num('shieldX');
    const sy = num('shieldY');
    if (sx === undefined || sy === undefined) return null;
    const sx2 = num('shieldX2') ?? sx;
    const sy2 = num('shieldY2') ?? sy;
    // Approximate the full-energy radius the engine computes at shield-up:
    // baseSize + growth (+ the energy term, ~1).
    const r = ((num('shieldMinSize') ?? 8) + (num('shieldGrowth') ?? 0) + 1) * camera.scale;
    if (r <= 0) return null;
    const points = getCapsulePoints(toSvgX(sx), toSvgY(sy), toSvgX(sx2), toSvgY(sy2), r);
    return (
      <g pointerEvents="none">
        <polygon
          points={points}
          fill="#6aa9ff"
          fillOpacity={0.12}
          stroke="#6aa9ff"
          strokeWidth={1}
        />
        <text
          x={toSvgX((sx + sx2) / 2)}
          y={toSvgY((sy + sy2) / 2)}
          fill="#6aa9ff"
          fontFamily="monospace"
          fontSize="9"
          textAnchor="middle"
          opacity={0.8}
        >
          shield
        </text>
      </g>
    );
  };

  // --- Bone-name labels ----------------------------------------
  const labelMap = useMemo(() => bubbleLabels(character), [character]);
  const namedIndices = useMemo(() => {
    // Indices that carry a character-level alias (head/core) are always shown.
    const set = new Set<number>();
    for (const k of Object.getOwnPropertyNames(character)) {
      if (k.endsWith('bubble') && typeof (character as Record<string, unknown>)[k] === 'number') {
        set.add((character as Record<string, unknown>)[k] as number);
      }
    }
    return set;
  }, [character]);

  const renderLabels = () => {
    const pose = displayPose ?? hurtbubbles;
    if (!pose) return null;
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i * 4 < pose.length; i++) {
      const base = i * 4;
      const label = labelMap.get(i);
      if (!label) continue;
      const show = showLabels || namedIndices.has(i) || hoveredBubble === i;
      if (!show) continue;
      const named = namedIndices.has(i);
      nodes.push(
        <text
          key={`label-${i}`}
          x={toSvgX(pose[base]) + pose[base + 2] * camera.scale + 4}
          y={toSvgY(pose[base + 1]) - 2}
          fill={named ? '#ffe066' : 'var(--fg-mute, #8a93a3)'}
          fontFamily="monospace"
          fontSize="9"
          pointerEvents="none"
          opacity={named ? 0.95 : 0.8}
        >
          {label}
        </text>
      );
    }
    return nodes;
  };

  // --- Hitbubble rendering -------------------------------------
  const renderHitbubbles = () => {
    if (!showHitboxes || !hitbubbles) return null;
    const pose = displayPose ?? hurtbubbles;
    return hitbubbles.map((hb, i) => {
      const resolved = resolveHitbubble(hb, character, pose);
      const cx = toSvgX(resolved.x);
      const cy = toSvgY(resolved.y);
      const r = (hb.radius ?? 0) * camera.scale;
      const color = HitbubbleColors[hb.type as string] ?? HitbubbleColors.none;
      const selected = i === selectedHitbubble;
      const opacity = selected ? 0.5 : 0.32;

      return (
        <g key={`hit-${i}`} style={{ cursor: 'pointer' }}>
          {/* Smear trail */}
          {resolved.hasSmear && (
            <g>
              <line
                x1={toSvgX(resolved.smearX)}
                y1={toSvgY(resolved.smearY)}
                x2={cx}
                y2={cy}
                stroke={color}
                strokeWidth="1.2"
                strokeDasharray="4 3"
                opacity="0.5"
              />
              <circle
                cx={toSvgX(resolved.smearX)}
                cy={toSvgY(resolved.smearY)}
                r={r}
                fill={color}
                opacity="0.10"
                stroke={color}
                strokeWidth="0.5"
                strokeDasharray="2 3"
              />
            </g>
          )}
          {resolved.hasAnchor && (
            <line
              x1={cx}
              y1={cy}
              x2={toSvgX(resolved.anchorX)}
              y2={toSvgY(resolved.anchorY)}
              stroke={color}
              strokeWidth="0.9"
              strokeDasharray="3 2"
              opacity="0.7"
            />
          )}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill={color}
            fillOpacity={opacity}
            stroke={color}
            strokeWidth={selected ? 2 : 1}
          />
          {/* Knockback gizmo */}
          {(typeof hb.knockback === 'number' || typeof hb.angle === 'number') && (
            <KnockbackGizmo cx={cx} cy={cy} r={r} hb={hb} color={color} selected={selected} />
          )}
          {selected && (
            <text x={cx + r + 6} y={cy + 3} fill={color} fontFamily="monospace" fontSize="10">
              #{i} {(hb.damage ?? 0).toString()}%
            </text>
          )}
        </g>
      );
    });
  };

  // --- Selected hurtbubble overlay -----------------------------
  let selectedOverlay: React.ReactNode = null;
  if (selectedBubble >= 0 && hurtbubbles) {
    const base = selectedBubble * 4;
    if (base + 2 < hurtbubbles.length) {
      const sx = toSvgX(hurtbubbles[base]);
      const sy = toSvgY(hurtbubbles[base + 1]);
      const sr = hurtbubbles[base + 2] * camera.scale;
      selectedOverlay = (
        <g>
          <circle
            cx={sx}
            cy={sy}
            r={sr}
            fill="rgba(106, 169, 255, 0.18)"
            stroke="#6aa9ff"
            strokeWidth="1.5"
          />
          <line
            x1={sx - sr - 6}
            y1={sy}
            x2={sx + sr + 6}
            y2={sy}
            stroke="#6aa9ff"
            strokeWidth="0.6"
          />
          <line
            x1={sx}
            y1={sy - sr - 6}
            x2={sx}
            y2={sy + sr + 6}
            stroke="#6aa9ff"
            strokeWidth="0.6"
          />
          <text x={sx + sr + 6} y={sy + 3} fill="#6aa9ff" fontFamily="monospace" fontSize="10">
            #{selectedBubble}
          </text>
        </g>
      );
    }
  }

  // --- Group selection highlights ------------------------------
  let groupOverlay: React.ReactNode = null;
  if (groupSel.size > 1 && hurtbubbles) {
    groupOverlay = (
      <g pointerEvents="none">
        {[...groupSel].map((i) => {
          const base = i * 4;
          if (base + 2 >= hurtbubbles.length) return null;
          return (
            <circle
              key={`grp-${i}`}
              cx={toSvgX(hurtbubbles[base])}
              cy={toSvgY(hurtbubbles[base + 1])}
              r={hurtbubbles[base + 2] * camera.scale}
              fill="rgba(122, 222, 160, 0.16)"
              stroke="#7adea0"
              strokeWidth="1.5"
            />
          );
        })}
      </g>
    );
  }

  // --- Marquee rectangle ---------------------------------------
  const marqueeOverlay = marquee ? (
    <rect
      x={Math.min(marquee.x1, marquee.x2)}
      y={Math.min(marquee.y1, marquee.y2)}
      width={Math.abs(marquee.x2 - marquee.x1)}
      height={Math.abs(marquee.y2 - marquee.y1)}
      fill="rgba(122, 222, 160, 0.10)"
      stroke="#7adea0"
      strokeWidth="1"
      strokeDasharray="4 3"
      pointerEvents="none"
    />
  ) : null;

  const originAxes = (
    <g>
      {showGround && (
        <line
          x1={0}
          y1={oy}
          x2={w}
          y2={oy}
          stroke="#5ad48f"
          strokeWidth="1"
          strokeDasharray="6 4"
          opacity="0.55"
        />
      )}
    </g>
  );

  return (
    <div ref={containerRef} className="stageCanvas">
      <svg
        ref={svgRef}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => setHoveredBubble(-1)}
        onWheel={handleWheel}
        onContextMenu={onContextMenu}
      >
        {gridLines}
        {originAxes}
        {renderOnionSkin()}
        {renderHurtbubbles()}
        {renderModelTransforms()}
        {renderShield()}
        {renderHitbubbles()}
        {renderLabels()}
        {groupOverlay}
        {selectedOverlay}
        {marqueeOverlay}
      </svg>
    </div>
  );
};
