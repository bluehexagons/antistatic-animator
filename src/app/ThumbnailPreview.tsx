/**
 * ThumbnailPreview — small auto-fit SVG used in the timeline strip.
 * Picks a camera that frames the keyframe's bubbles.
 */

import React, { useMemo } from 'react';
import type { Animation, EntityData } from '../animator/types';

export interface ThumbnailPreviewProps {
  character: EntityData;
  animation: Animation;
  keyframeIndex: number;
}

export const ThumbnailPreview: React.FC<ThumbnailPreviewProps> = ({
  character,
  animation,
  keyframeIndex,
}) => {
  const kf = animation.keyframes[keyframeIndex];
  const hb = kf?.hurtbubbles;

  const view = useMemo(() => {
    if (!hb || !Array.isArray(hb) || hb.length === 0) {
      return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < hb.length; i += 4) {
      const x = hb[i];
      const y = hb[i + 1];
      const r = hb[i + 2];
      if (x - r < minX) minX = x - r;
      if (y - r < minY) minY = y - r;
      if (x + r > maxX) maxX = x + r;
      if (y + r > maxY) maxY = y + r;
    }
    const pad = 2;
    return {
      minX: minX - pad,
      minY: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }, [hb]);

  if (!view || !hb || !Array.isArray(hb)) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 100 60">
        <rect width="100" height="60" fill="transparent" />
        <text x="50" y="30" textAnchor="middle" fill="#6b7383" fontSize="8" fontFamily="monospace">
          empty
        </text>
      </svg>
    );
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`${view.minX} ${-view.minY - view.height} ${view.width} ${view.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {character.hurtbubbles.map((bone, idx) => {
        const i1 = bone.i1 * 4;
        const i2 = bone.i2 * 4;
        if (i1 >= hb.length || i2 >= hb.length) return null;
        const x1 = hb[i1];
        const y1 = -hb[i1 + 1];
        const x2 = hb[i2];
        const y2 = -hb[i2 + 1];
        const r = hb[i1 + 2];
        return (
          <g key={idx}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(205, 210, 220, 0.85)"
              strokeWidth={r * 2}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
};
