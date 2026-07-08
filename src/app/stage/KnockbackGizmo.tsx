/**
 * KnockbackGizmo — renders the knockback direction + magnitude as an
 * arrow rooted at the hitbubble centre. Sakurai-angle hitboxes get an
 * extra ground-angle leg.
 */

import React from 'react';
import type { Hitbubble } from '../../animator/types';

interface KnockbackGizmoProps {
  cx: number;
  cy: number;
  r: number;
  hb: Hitbubble;
  color: string;
  selected: boolean;
}

export const KnockbackGizmo: React.FC<KnockbackGizmoProps> = ({
  cx,
  cy,
  r,
  hb,
  color,
  selected,
}) => {
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
