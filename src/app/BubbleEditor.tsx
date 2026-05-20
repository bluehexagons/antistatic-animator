/**
 * BubbleEditor — compact table-style editor for the hurtbubble array of
 * the currently selected keyframe. Lets the user select / nudge / edit
 * individual coords. Forward-compatible with a future Z axis.
 */

import React, { useCallback, useEffect } from 'react';
import type { Animation, EntityData } from '../animator/types';
import { HurtbubbleStates } from '../animator/schema';

export interface BubbleEditorProps {
  character: EntityData;
  animation: Animation;
  keyframe: number;
  selectedBubble: number;
  onSelectBubble: (i: number) => void;
  onChange: () => void;
}

const FIELDS = 4; // x, y, r, state

export const BubbleEditor: React.FC<BubbleEditorProps> = ({
  character,
  animation,
  keyframe,
  selectedBubble,
  onSelectBubble,
  onChange,
}) => {
  const kf = animation.keyframes[keyframe];
  const hb = kf?.hurtbubbles;
  const bones = character.hurtbubbles;

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

  const boneNameFor = (bubbleIdx: number): string | null => {
    // Find a bone whose i1 or i2 matches this bubble index.
    for (const bone of bones) {
      if (bone.i1 === bubbleIdx) return bone.name;
      if (bone.i2 === bubbleIdx) return `${bone.name}2`;
    }
    return null;
  };

  return (
    <div>
      <div className="bubbleHeader bubbleHeaderState">
        <span className="idx">#</span>
        <span>bone</span>
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
          const stateId = hb[base + 3];
          const state = HurtbubbleStates.find((s) => s.id === stateId);
          const name = boneNameFor(i);
          return (
            <div
              key={i}
              className={`bubbleRow bubbleRowState ${active ? 'active' : ''}`}
              onMouseDown={() => onSelectBubble(i)}
              style={state ? { borderLeft: `3px solid ${state.color}` } : undefined}
            >
              <span className="idx">{i}</span>
              <span className="boneName" title={name ?? ''}>
                {name ?? '—'}
              </span>
              {[0, 1, 2].map((f) => (
                <input
                  key={f}
                  type="number"
                  step="any"
                  value={Number.isFinite(hb[base + f]) ? hb[base + f] : 0}
                  onChange={(e) => setField(i, f, e.target.value)}
                  onFocus={() => onSelectBubble(i)}
                />
              ))}
              <select
                value={Number.isFinite(stateId) ? stateId : 1}
                onChange={(e) => {
                  hb[base + 3] = parseInt(e.target.value, 10);
                  onChange();
                }}
                onFocus={() => onSelectBubble(i)}
                title={state?.desc ?? 'Hurtbubble state'}
              >
                {HurtbubbleStates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}: {s.name}
                  </option>
                ))}
              </select>
              <span />
            </div>
          );
        })}
      </div>
    </div>
  );
};
