/**
 * BubbleEditor — compact table-style editor for the hurtbubble array of
 * the currently selected keyframe. Lets the user select / nudge / edit
 * individual coords. Forward-compatible with a future Z axis.
 */

import React, { useCallback, useEffect } from 'react';
import type { Animation } from '../animator/types';

export interface BubbleEditorProps {
  animation: Animation;
  keyframe: number;
  selectedBubble: number;
  onSelectBubble: (i: number) => void;
  onChange: () => void;
}

const FIELDS = 4; // x, y, r, state

export const BubbleEditor: React.FC<BubbleEditorProps> = ({
  animation,
  keyframe,
  selectedBubble,
  onSelectBubble,
  onChange,
}) => {
  const kf = animation.keyframes[keyframe];
  const hb = kf?.hurtbubbles;

  // Keyboard nudge handler scoped to this editor (works whenever any input here is focused
  // or when no other editable target has focus).
  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (selectedBubble < 0 || !hb) return;
      const i = selectedBubble * FIELDS;
      if (i >= hb.length) return;
      hb[i] = (hb[i] ?? 0) + dx;
      hb[i + 1] = (hb[i + 1] ?? 0) + dy;
      onChange();
    },
    [selectedBubble, hb, onChange]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // Don't hijack if user is typing in an input/textarea/contenteditable.
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      const step = e.shiftKey ? 5 : e.altKey ? 0.1 : 1;
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          nudge(0, step);
          e.preventDefault();
          break;
        case 'arrowdown':
        case 's':
          nudge(0, -step);
          e.preventDefault();
          break;
        case 'arrowleft':
        case 'a':
          nudge(-step, 0);
          e.preventDefault();
          break;
        case 'arrowright':
        case 'd':
          nudge(step, 0);
          e.preventDefault();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [nudge]);

  if (!hb || !Array.isArray(hb) || hb.length === 0) {
    return <div className="listEmpty">No hurtbubbles in this keyframe</div>;
  }

  const count = Math.floor(hb.length / FIELDS);
  const setField = (idx: number, f: number, value: string) => {
    const num = parseFloat(value);
    hb[idx * FIELDS + f] = Number.isFinite(num) ? num : 0;
    onChange();
  };

  return (
    <div>
      <div className="bubbleHeader">
        <span className="idx">#</span>
        <span>x</span>
        <span>y</span>
        <span>r</span>
        <span>state</span>
        <span />
      </div>
      <div className="bubbleList">
        {Array.from({ length: count }).map((_, i) => {
          const base = i * FIELDS;
          const active = selectedBubble === i;
          return (
            <div
              key={i}
              className={`bubbleRow ${active ? 'active' : ''}`}
              onMouseDown={() => onSelectBubble(i)}
            >
              <span className="idx">{i}</span>
              {[0, 1, 2, 3].map((f) => (
                <input
                  key={f}
                  type="number"
                  step="any"
                  value={Number.isFinite(hb[base + f]) ? hb[base + f] : 0}
                  onChange={(e) => setField(i, f, e.target.value)}
                  onFocus={() => onSelectBubble(i)}
                />
              ))}
              <span />
            </div>
          );
        })}
      </div>
    </div>
  );
};
