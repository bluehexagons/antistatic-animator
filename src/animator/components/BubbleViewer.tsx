/**
 * BubbleViewer Component
 *
 * SVG-based renderer for hitbubbles and hurtbubbles.
 * Replaces the canvas-based paintBubbles function.
 */

import React, { useRef, useCallback } from 'react';
import type { EntityData, Animation, Hitbubble } from '../types';
import { objHas } from '../../utils';
import { hbmap } from '../rendering/bubble-finder';
import type { CameraState } from '../context/AnimatorContext';

interface BubbleViewerProps {
  character: EntityData | null;
  animation: Animation | null;
  keyframe: number;
  camera: CameraState;
  highlightBubble?: number;
  activeBubble?: number;
  onBubbleHover?: (bubbleIndex: number) => void;
  onBubbleClick?: (bubbleIndex: number) => void;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>, action: 'move' | 'pan') => void;
  width?: number;
  height?: number;
}

/**
 * Generate polygon points for a capsule shape between two points
 * Derived from the canvas-utils pathCapsule math
 */
function getCapsulePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
  angles = 4
): number[] {
  const points: number[] = [];
  const rads = 2 * Math.PI - Math.atan2(x2 - x1, y2 - y1);
  let perp = rads - Math.PI;
  const step = (1 / angles) * Math.PI;

  // First arc (at point 1)
  for (let i = 0; i < angles; i++) {
    points.push(x1 + Math.cos(perp) * r);
    points.push(y1 + Math.sin(perp) * r);
    perp += step;
  }

  // Second arc (at point 2)
  perp = rads + Math.PI * 2;
  for (let i = 0; i < angles + 1; i++) {
    points.push(x2 + Math.cos(perp) * r);
    points.push(y2 + Math.sin(perp) * r);
    perp += step;
  }

  return points;
}

/**
 * Convert points array to SVG polygon points string
 */
function pointsToString(points: number[]): string {
  const pairs: string[] = [];
  for (let i = 0; i < points.length; i += 2) {
    pairs.push(`${points[i]},${points[i + 1]}`);
  }
  return pairs.join(' ');
}

export const BubbleViewer: React.FC<BubbleViewerProps> = ({
  character,
  animation,
  keyframe,
  camera,
  highlightBubble = -1,
  activeBubble = -1,
  onBubbleHover,
  onBubbleClick,
  onPointerDown,
  width = 300,
  height = 200,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  if (!character || !animation || !animation.keyframes[keyframe]) {
    return (
      <svg ref={svgRef} width={width} height={height} style={{ background: 'black' }}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#666" />
        <line x1={width / 2} y1="0" x2={width / 2} y2={height} stroke="#666" />
      </svg>
    );
  }

  const kf = animation.keyframes[keyframe];
  const hurtbubbles = kf.hurtbubbles;

  // Convert normalized camera offsets to pixel coordinates
  const ox_px = width * (0.5 + camera.x * 0.5);
  const oy_px = height * (0.5 + camera.y * 0.5);

  // Helper to convert world coords to SVG coords
  const toSvgX = (worldX: number): number => worldX * camera.scale + ox_px;
  const toSvgY = (worldY: number): number => -worldY * camera.scale + oy_px;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;

      const rect = svgRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      // Convert pixel to world coordinates
      const worldX = (px - ox_px) / camera.scale;
      const worldY = -(py - oy_px) / camera.scale;

      if (e.button === 0) {
        // Left-click: try to find and select a bubble
        if (hurtbubbles && character) {
          let found = -1;
          for (let i = 0; i < hurtbubbles.length; i += 4) {
            const bx = hurtbubbles[i];
            const by = hurtbubbles[i + 1];
            const br = hurtbubbles[i + 2];
            const dist = Math.sqrt((worldX - bx) ** 2 + (worldY - by) ** 2);
            if (dist <= br) {
              found = i / 4;
              break;
            }
          }
          if (found >= 0) {
            onBubbleClick?.(found);
            onPointerDown?.(e, 'move');
          }
        }
      } else if (e.button === 2) {
        // Right-click: pan camera
        onPointerDown?.(e, 'pan');
      }

      e.preventDefault();
    },
    [camera, hurtbubbles, character, onBubbleClick, onPointerDown, ox_px, oy_px]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || !hurtbubbles) return;

      const rect = svgRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const worldX = (px - ox_px) / camera.scale;
      const worldY = -(py - oy_px) / camera.scale;

      // Find hovered bubble
      let found = -1;
      for (let i = 0; i < hurtbubbles.length; i += 4) {
        const bx = hurtbubbles[i];
        const by = hurtbubbles[i + 1];
        const br = hurtbubbles[i + 2];
        const dist = Math.sqrt((worldX - bx) ** 2 + (worldY - by) ** 2);
        if (dist <= br) {
          found = i / 4;
          break;
        }
      }
      onBubbleHover?.(found);
    },
    [hurtbubbles, camera, onBubbleHover, ox_px, oy_px]
  );

  if (!hurtbubbles || !Array.isArray(hurtbubbles)) {
    return (
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ background: 'black', cursor: 'default' }}
        onPointerDown={handlePointerDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <line x1="0" y1={oy_px | 0} x2={width} y2={oy_px | 0} stroke="#666" />
        <line x1={ox_px | 0} y1="0" x2={ox_px | 0} y2={height} stroke="#666" />
      </svg>
    );
  }

  // Resolve hitbubbles
  let hitbubbles: Hitbubble[] | null = null;
  if (objHas(kf, 'hitbubbles')) {
    let ckf = kf;
    let hbkf = keyframe;
    while (ckf.hitbubbles === true) {
      hbkf--;
      ckf = animation.keyframes[hbkf];
    }
    hitbubbles = ckf.hitbubbles;
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{ background: 'black', cursor: 'crosshair', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onMouseMove={handleMouseMove}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Origin grid */}
      <line x1="0" y1={oy_px | 0} x2={width} y2={oy_px | 0} stroke="#666" strokeWidth="0.5" />
      <line x1={ox_px | 0} y1="0" x2={ox_px | 0} y2={height} stroke="#666" strokeWidth="0.5" />

      {/* Hitbubbles */}
      {hitbubbles &&
        hitbubbles.map((hb, i) => {
          let x = 0;
          let y = 0;
          let anchorX = 0;
          let anchorY = 0;

          if (objHas(hb, 'x')) x = hb.x;
          if (objHas(hb, 'y')) y = hb.y;

          if (objHas(hb, 'follow')) {
            const m = hbmap(character.hurtbubbles);
            const hbindex = m.get(hb.follow);
            if (hbindex !== undefined) {
              const b = character.hurtbubbles[Math.abs(hbindex) - 1];
              const index = 4 * (hbindex > 0 ? b.i1 : b.i2);
              x += hurtbubbles[index];
              y += hurtbubbles[1 + index];
              anchorX = hurtbubbles[index];
              anchorY = hurtbubbles[1 + index];
            }
          }

          const cx = toSvgX(x);
          const cy = toSvgY(y);
          const r = (hb.radius || 0) * camera.scale;

          return (
            <g key={`hitbubble-${i}`}>
              <circle cx={cx} cy={cy} r={r} fill="rgba(255, 0, 0, 0.6)" stroke="black" />
              {/* Connection line to anchor bone */}
              {objHas(hb, 'follow') && (
                <>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={toSvgX(anchorX)}
                    y2={toSvgY(anchorY)}
                    stroke="rgba(100, 0, 0, 1)"
                    strokeWidth="1"
                  />
                  <circle cx={cx} cy={cy} r={3} fill="none" stroke="rgba(100, 0, 0, 1)" />
                </>
              )}
            </g>
          );
        })}

      {/* Hurtbubbles */}
      {character.hurtbubbles.map((bone, boneIdx) => {
        const hb1 = bone.i1 * 4;
        const hb2 = bone.i2 * 4;
        const x1 = toSvgX(hurtbubbles[hb1 + 0]);
        const y1 = toSvgY(hurtbubbles[hb1 + 1]);
        const x2 = toSvgX(hurtbubbles[hb2 + 0]);
        const y2 = toSvgY(hurtbubbles[hb2 + 1]);
        const r = hurtbubbles[hb1 + 2] * camera.scale;

        const capsulePoints = getCapsulePoints(x1, y1, x2, y2, r, 4);
        const pointsStr = pointsToString(capsulePoints);

        return (
          <polygon
            key={`hurtbubble-${boneIdx}`}
            points={pointsStr}
            fill="rgba(255, 255, 255, 0.5)"
            stroke="black"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Highlight bubble (green) */}
      {highlightBubble >= 0 && (
        <circle
          cx={toSvgX(hurtbubbles[highlightBubble * 4 + 0])}
          cy={toSvgY(hurtbubbles[highlightBubble * 4 + 1])}
          r={hurtbubbles[highlightBubble * 4 + 2] * camera.scale}
          fill="rgba(0, 255, 0, 0.25)"
          stroke="green"
          strokeWidth="1"
        />
      )}

      {/* Active bubble (yellow) */}
      {activeBubble >= 0 && (
        <circle
          cx={toSvgX(hurtbubbles[activeBubble * 4 + 0])}
          cy={toSvgY(hurtbubbles[activeBubble * 4 + 1])}
          r={hurtbubbles[activeBubble * 4 + 2] * camera.scale}
          fill="rgba(255, 255, 0, 0.33)"
          stroke="yellow"
          strokeWidth="1"
        />
      )}

      {/* Highlight guide lines */}
      {highlightBubble >= 0 && (
        <>
          <line
            x1="0"
            y1={toSvgY(hurtbubbles[highlightBubble * 4 + 1])}
            x2={width}
            y2={toSvgY(hurtbubbles[highlightBubble * 4 + 1])}
            stroke={
              hurtbubbles[highlightBubble * 4 + 1] === 0
                ? 'rgba(64, 255, 64, 0.6)'
                : 'rgba(64, 255, 64, 0.2)'
            }
            strokeWidth="0.5"
          />
          <line
            x1={toSvgX(hurtbubbles[highlightBubble * 4 + 0])}
            y1="0"
            x2={toSvgX(hurtbubbles[highlightBubble * 4 + 0])}
            y2={height}
            stroke={
              hurtbubbles[highlightBubble * 4 + 0] === 0
                ? 'rgba(64, 255, 64, 0.6)'
                : 'rgba(64, 255, 64, 0.2)'
            }
            strokeWidth="0.5"
          />
        </>
      )}
    </svg>
  );
};
