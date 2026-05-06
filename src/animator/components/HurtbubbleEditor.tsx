/**
 * HurtbubbleEditor Component
 *
 * Editable UI for hurtbubble coordinates with keyboard support.
 * Replaces the makeKeyframeEditor function from init.ts.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type { Animation } from '../types';

interface HurtbubbleEditorProps {
  animation: Animation;
  keyframe: number;
  selectedBubble: number;
  onSelectedBubbleChange: (index: number) => void;
  onHurtbubbleChange: () => void;
}

export const HurtbubbleEditor: React.FC<HurtbubbleEditorProps> = ({
  animation,
  keyframe,
  selectedBubble,
  onSelectedBubbleChange,
  onHurtbubbleChange,
}) => {
  const kf = animation.keyframes[keyframe];
  const hb = kf.hurtbubbles;

  // Direction tracking for keyboard input
  const keysDownRef = useRef<Set<string>>(new Set());
  const directionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const nudgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const NUDGE_DELAY = 120;
  const SPEED = 16;

  const moveSelectedBubble = useCallback(
    (dx: number, dy: number) => {
      if (selectedBubble < 0 || !hb) return;
      const index = selectedBubble * 4;
      if (index >= hb.length) return;

      hb[index] += dx;
      hb[index + 1] += dy;
      onHurtbubbleChange();
    },
    [selectedBubble, hb, onHurtbubbleChange]
  );

  const keytick = useCallback(() => {
    if (directionRef.current.x !== 0 || directionRef.current.y !== 0) {
      moveSelectedBubble(directionRef.current.x, directionRef.current.y);
      rafRef.current = setTimeout(keytick, SPEED);
    }
  }, [moveSelectedBubble]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Arrow keys and WASD
      const dirMap: Record<string, [number, number]> = {
        arrowup: [0, 1],
        arrowdown: [0, -1],
        arrowright: [1, 0],
        arrowleft: [-1, 0],
        w: [0, 1],
        s: [0, -1],
        d: [1, 0],
        a: [-1, 0],
      };

      if (dirMap[key]) {
        keysDownRef.current.add(key);
        const [dx, dy] = dirMap[key];

        // Immediate first nudge
        moveSelectedBubble(dx, dy);

        // Clear existing timeouts
        if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
        if (rafRef.current) clearTimeout(rafRef.current);

        // Set up repeat after delay
        nudgeTimeoutRef.current = setTimeout(() => {
          // Update direction based on all currently held keys
          let finalDx = 0;
          let finalDy = 0;
          keysDownRef.current.forEach((k) => {
            if (dirMap[k]) {
              const [dx, dy] = dirMap[k];
              finalDx += dx;
              finalDy += dy;
            }
          });

          directionRef.current = { x: finalDx, y: finalDy };

          // Start repeating timer loop
          const speedTick = () => {
            if (directionRef.current.x !== 0 || directionRef.current.y !== 0) {
              moveSelectedBubble(directionRef.current.x, directionRef.current.y);
              rafRef.current = setTimeout(speedTick, SPEED);
            }
          };
          speedTick();
        }, NUDGE_DELAY);

        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysDownRef.current.delete(key);

      // If no keys are pressed, stop the repeat
      if (keysDownRef.current.size === 0) {
        if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
        if (rafRef.current) clearTimeout(rafRef.current);
        directionRef.current = { x: 0, y: 0 };
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);

      if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
      if (rafRef.current) clearTimeout(rafRef.current);
    };
  }, [moveSelectedBubble]);

  if (!hb || !Array.isArray(hb)) {
    return <div>No hurtbubbles in this keyframe</div>;
  }

  return (
    <div className="edit-hurtbubbles">
      {Array.from({ length: hb.length / 4 }).map((_, i) => {
        const index = i * 4;
        const isSelected = selectedBubble === i;

        const handleChange = (field: 0 | 1 | 2 | 3, value: string) => {
          const numValue = parseFloat(value) || 0;
          hb[index + field] = numValue;
          onHurtbubbleChange();
        };

        const handleFocus = () => {
          onSelectedBubbleChange(i);
        };

        return (
          <div key={`hurtbubble-${i}`} className={isSelected ? 'bubbleline-focused' : ''}>
            <input
              type="number"
              className="input bubble-coord"
              value={hb[index]}
              onChange={(e) => handleChange(0, e.target.value)}
              onFocus={handleFocus}
            />
            <span>,</span>
            <input
              type="number"
              className="input bubble-coord"
              value={hb[index + 1]}
              onChange={(e) => handleChange(1, e.target.value)}
              onFocus={handleFocus}
            />
            <span> (r=</span>
            <input
              type="number"
              className="input bubble-coord"
              value={hb[index + 2]}
              onChange={(e) => handleChange(2, e.target.value)}
              onFocus={handleFocus}
            />
            <span>, state=</span>
            <input
              type="number"
              className="input bubble-coord"
              value={hb[index + 3]}
              onChange={(e) => handleChange(3, e.target.value)}
              onFocus={handleFocus}
            />
            <span>)</span>
          </div>
        );
      })}
    </div>
  );
};
