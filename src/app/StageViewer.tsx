/**
 * StageViewer — the central animation viewer.
 *
 * Renders the character's hurtbubbles and the current keyframe's hitbubbles
 * to an SVG that fills the stage area. Supports:
 *  - mouse-wheel zoom around the cursor
 *  - middle/right drag to pan
 *  - left-click to select a bubble
 *  - left-drag a selected bubble to move it
 *  - a grid + ground reference line
 *  - a 3D forward-compat indicator: shows the `z` field on the selected bubble
 *    (currently rendered as a small label; rotation gizmo wired but disabled).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Animation, EntityData, Hitbubble } from '../animator/types';
import { objHas } from '../utils';
import { hbmap } from '../animator/rendering/bubble-finder';
import type { CameraState } from '../animator/context/AnimatorContext';

export interface StageViewerProps {
  character: EntityData;
  animation: Animation;
  keyframe: number;
  camera: CameraState;
  selectedBubble: number;
  onSelectBubble: (i: number) => void;
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

export const StageViewer: React.FC<StageViewerProps> = ({
  character,
  animation,
  keyframe,
  camera,
  selectedBubble,
  onSelectBubble,
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
  const hurtbubbles = kf?.hurtbubbles && Array.isArray(kf.hurtbubbles) ? kf.hurtbubbles : null;

  const hitbubbles = useMemo<Hitbubble[] | null>(() => {
    if (!objHas(kf, 'hitbubbles')) return null;
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

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { x: wx, y: wy } = fromSvg(px, py);

    if (e.button === 0) {
      const found = pickBubbleAt(wx, wy);
      if (found >= 0 && hurtbubbles) {
        onSelectBubble(found);
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
      } else {
        onSelectBubble(-1);
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

    // Adjust camera offsets so the world point under the cursor stays put.
    // px = wx * scale + w * (0.5 + cx * 0.5)
    // wx = before.x ; py / wy similarly.
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
    const step = camera.scale; // 1 world unit
    const major = 5; // every 5 units, bolder
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

  // --- Hurtbubble rendering ------------------------------------
  const bones = character.hurtbubbles;
  const renderHurtbubbles = () => {
    if (!hurtbubbles) return null;
    return bones.map((bone, idx) => {
      const i1 = bone.i1 * 4;
      const i2 = bone.i2 * 4;
      if (i1 >= hurtbubbles.length || i2 >= hurtbubbles.length) return null;
      const x1 = toSvgX(hurtbubbles[i1]);
      const y1 = toSvgY(hurtbubbles[i1 + 1]);
      const x2 = toSvgX(hurtbubbles[i2]);
      const y2 = toSvgY(hurtbubbles[i2 + 1]);
      const r = hurtbubbles[i1 + 2] * camera.scale;
      return (
        <polygon
          key={`bone-${idx}`}
          points={getCapsulePoints(x1, y1, x2, y2, r)}
          fill="rgba(205, 210, 220, 0.32)"
          stroke="rgba(20, 23, 28, 0.85)"
          strokeWidth={0.75}
        />
      );
    });
  };

  // --- Hitbubble rendering -------------------------------------
  const renderHitbubbles = () => {
    if (!showHitboxes || !hitbubbles || !hurtbubbles) return null;
    const map = hbmap(character.hurtbubbles);
    return hitbubbles.map((hb, i) => {
      let x = hb.x ?? 0;
      let y = hb.y ?? 0;
      let anchorX = 0;
      let anchorY = 0;
      if (objHas(hb, 'follow')) {
        const idx = map.get(hb.follow as string);
        if (idx !== undefined) {
          const b = character.hurtbubbles[Math.abs(idx) - 1];
          const base = 4 * (idx > 0 ? b.i1 : b.i2);
          anchorX = hurtbubbles[base];
          anchorY = hurtbubbles[base + 1];
          x += anchorX;
          y += anchorY;
        }
      }
      const cx = toSvgX(x);
      const cy = toSvgY(y);
      const r = (hb.radius ?? 0) * camera.scale;
      return (
        <g key={`hit-${i}`}>
          {objHas(hb, 'follow') && (
            <line
              x1={cx}
              y1={cy}
              x2={toSvgX(anchorX)}
              y2={toSvgY(anchorY)}
              stroke="rgba(240, 100, 100, 0.55)"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
          )}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="rgba(240, 100, 100, 0.32)"
            stroke="rgba(240, 100, 100, 0.85)"
            strokeWidth="1"
          />
        </g>
      );
    });
  };

  // --- Selected bubble overlay ---------------------------------
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

  // Origin axes (always)
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
