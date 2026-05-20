/**
 * StageViewer — the central animation viewer.
 *
 * Renders the character's hurtbubbles and the current keyframe's hitbubbles
 * to an SVG that fills the stage area. Supports:
 *  - mouse-wheel zoom around the cursor
 *  - middle/right drag to pan
 *  - left-click to select a bubble (hurtbubble or hitbubble)
 *  - left-drag a selected hurtbubble to move it
 *  - a grid + ground reference line
 *  - hurtbubble tint by HurtbubbleState (armor/intangible/etc.)
 *  - hitbubble tint by HitbubbleType + smear trails + knockback gizmo
 *  - z-axis tinting (front warmer / back cooler) using bone.z
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Animation, EntityData, Hitbubble } from '../animator/types';
import { objHas } from '../utils';
import { hbmap } from '../animator/rendering/bubble-finder';
import type { CameraState } from '../animator/context/AnimatorContext';
import { HitbubbleColors, HurtbubbleStateById } from '../animator/schema';
import { interpolatedPose } from '../animator/operations/interpolate';

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
}

interface Size {
  w: number;
  h: number;
}

function getCapsulePoints(x1: number, y1: number, x2: number, y2: number, r: number) {
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

/** Resolve a hitbubble's world position, including follow + smear anchors. */
function resolveHitbubble(hb: Hitbubble, character: EntityData, hurtbubbles: number[] | null) {
  let x = hb.x ?? 0;
  let y = hb.y ?? 0;
  let anchorX = 0;
  let anchorY = 0;
  let hasAnchor = false;
  let smearX = (hb.smear as { x?: number } | undefined)?.x ?? 0;
  let smearY = (hb.smear as { y?: number } | undefined)?.y ?? 0;
  let smearAnchorX = 0;
  let smearAnchorY = 0;
  let hasSmear = !!hb.smear;
  let smearAnchorPresent = false;

  if (hurtbubbles && objHas(hb, 'follow')) {
    const map = hbmap(character.hurtbubbles);
    const idx = map.get(hb.follow as string);
    if (idx !== undefined) {
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
    const smear = hb.smear as { follow?: string; x?: number; y?: number };
    if (smear.follow) {
      const map = hbmap(character.hurtbubbles);
      const idx = map.get(smear.follow);
      if (idx !== undefined) {
        const b = character.hurtbubbles[Math.abs(idx) - 1];
        const base = 4 * (idx > 0 ? b.i1 : b.i2);
        smearAnchorX = hurtbubbles[base] ?? 0;
        smearAnchorY = hurtbubbles[base + 1] ?? 0;
        smearX += smearAnchorX;
        smearY += smearAnchorY;
        smearAnchorPresent = true;
      }
    } else if (hasAnchor) {
      // smear without explicit follow inherits the hitbubble's follow anchor
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

/** Bone-z to tint nudge for the bones' capsule color (front warmer / back cooler). */
function zTint(z: number | undefined): { fill: string; stroke: string } {
  if (z === undefined || z === 0) {
    return { fill: 'rgba(205, 210, 220, 0.32)', stroke: 'rgba(20, 23, 28, 0.85)' };
  }
  if (z > 0) {
    // front: slightly warmer
    return { fill: 'rgba(255, 215, 180, 0.34)', stroke: 'rgba(60, 30, 20, 0.85)' };
  }
  return { fill: 'rgba(170, 200, 230, 0.30)', stroke: 'rgba(20, 30, 50, 0.85)' };
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>({ w: 800, h: 600 });
  const dragRef = useRef<{
    mode: 'pan' | 'move-bubble' | 'none';
    startClientX: number;
    startClientY: number;
    startCam: CameraState;
    startBubble?: { x: number; y: number; index: number };
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
        onSelectBubble(found);
        onSelectHitbubble(-1);
        svgRef.current.setPointerCapture(e.pointerId);
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
      } else if (hitIdx >= 0) {
        onSelectHitbubble(hitIdx);
        onSelectBubble(-1);
      } else {
        onSelectBubble(-1);
        onSelectHitbubble(-1);
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
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current.mode !== 'none') {
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
      const state = HurtbubbleStateById.get(pose[i1 + 3] as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 11);
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
        onWheel={handleWheel}
        onContextMenu={onContextMenu}
      >
        {gridLines}
        {originAxes}
        {renderHurtbubbles()}
        {renderHitbubbles()}
        {selectedOverlay}
      </svg>
    </div>
  );
};

interface KnockbackGizmoProps {
  cx: number;
  cy: number;
  r: number;
  hb: Hitbubble;
  color: string;
  selected: boolean;
}

/** Renders the knockback direction + magnitude as an arrow rooted at the
 *  hitbubble centre. Sakurai-angle hitboxes get an extra ground-angle leg. */
const KnockbackGizmo: React.FC<KnockbackGizmoProps> = ({ cx, cy, r, hb, color, selected }) => {
  const angle = typeof hb.angle === 'number' ? hb.angle : 0;
  const knockback = typeof hb.knockback === 'number' ? hb.knockback : 0;
  const growth = typeof hb.growth === 'number' ? hb.growth : 0;
  // Arrow length scales with KB; capped so it stays visible but doesn't fly off-screen.
  const len = Math.max(r * 1.2, Math.min(180, r * 0.8 + (knockback + growth * 0.6) * 3));
  const rad = (angle * Math.PI) / 180;
  // Game convention: angle 0 = right, 90 = up. SVG y is flipped.
  const ex = cx + Math.cos(rad) * len;
  const ey = cy - Math.sin(rad) * len;

  const arrowHead = (x: number, y: number, ax: number, ay: number) => {
    const a = Math.atan2(y - ay, x - ax);
    const sz = 6;
    const a1 = a + Math.PI / 6;
    const a2 = a - Math.PI / 6;
    return `M ${x} ${y} L ${x - Math.cos(a1) * sz} ${y - Math.sin(a1) * sz} L ${
      x - Math.cos(a2) * sz
    } ${y - Math.sin(a2) * sz} Z`;
  };

  const opacity = selected ? 0.95 : 0.55;

  return (
    <g>
      <line
        x1={cx}
        y1={cy}
        x2={ex}
        y2={ey}
        stroke={color}
        strokeWidth={selected ? 2 : 1.2}
        opacity={opacity}
      />
      <path d={arrowHead(ex, ey, cx, cy)} fill={color} opacity={opacity} />
      {hb.sakurai && (
        <>
          {/* Sakurai: also show grounded fallback at 45° (approximate). */}
          {(() => {
            const fallback = 45;
            const frad = (fallback * Math.PI) / 180;
            const fx = cx + Math.cos(frad) * len * 0.7;
            const fy = cy - Math.sin(frad) * len * 0.7;
            return (
              <line
                x1={cx}
                y1={cy}
                x2={fx}
                y2={fy}
                stroke={color}
                strokeWidth="0.8"
                strokeDasharray="2 3"
                opacity={opacity * 0.6}
              />
            );
          })()}
        </>
      )}
    </g>
  );
};
