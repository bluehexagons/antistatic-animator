/**
 * HitbubbleEditor — inspector control for the current keyframe's
 * `hitbubbles` field. Supports add/remove, all the engine-known
 * authoring fields, and the `hitbubbles: true` continuation flag.
 *
 * Schema reference: `bubbles.ts:226` (Hitbubble class fields) and the
 * subset actually used by shipped character JSONC.
 */

import React, { useMemo, useState } from 'react';
import type { Animation, EntityData, Hitbubble, Keyframe } from '../animator/types';
import { HitbubbleColors, HitbubbleFlags, HitbubbleTypes, flagsToNames } from '../animator/schema';
import { followCandidates } from '../utils';
import { PropertiesEditor } from './PropertiesEditor';

/** Keys the card already edits with dedicated controls — hidden from the
 *  generic "other properties" editor so they aren't shown twice. */
const HANDLED_KEYS = [
  'type',
  'follow',
  'x',
  'y',
  'x2',
  'y2',
  'radius',
  'damage',
  'knockback',
  'growth',
  'angle',
  'start',
  'end',
  'sakurai',
  'strong',
  'audio',
  'flags',
  'smear',
] as const;

/** Other engine-supported hitbubble fields, offered for quick-add. */
const EXTRA_FIELD_SUGGESTIONS = [
  'effect',
  'if',
  'next',
  'color',
  'addVelocity',
  'shieldDamage',
  'setLag',
  'lag',
  'onHit',
  'onBlocked',
];

export interface HitbubbleEditorProps {
  character: EntityData;
  animation: Animation;
  keyframe: number;
  selectedHitbubble: number;
  onSelect: (i: number) => void;
  onChange: () => void;
}

const NewHitbubbleDefaults = (): Hitbubble => ({
  type: 'ground',
  x: 0,
  y: 0,
  radius: 10,
  damage: 5,
  knockback: 5,
  growth: 5,
  angle: 45,
});

interface HitbubbleRowProps {
  index: number;
  hb: Hitbubble;
  active: boolean;
  followOptions: string[];
  onSelect: () => void;
  onChange: () => void;
  onRemove: () => void;
}

const FIELD_DEFS: {
  key: string;
  label: string;
  kind: 'num' | 'str' | 'bool';
  step?: string;
  min?: number;
}[] = [
  { key: 'x', label: 'x', kind: 'num', step: 'any' },
  { key: 'y', label: 'y', kind: 'num', step: 'any' },
  { key: 'radius', label: 'r', kind: 'num', step: 'any', min: 0 },
  { key: 'damage', label: 'dmg', kind: 'num', step: 'any' },
  { key: 'knockback', label: 'kb', kind: 'num', step: 'any' },
  { key: 'growth', label: 'kbg', kind: 'num', step: 'any' },
  { key: 'angle', label: 'ang', kind: 'num', step: 'any' },
  { key: 'x2', label: 'x2', kind: 'num', step: 'any' },
  { key: 'y2', label: 'y2', kind: 'num', step: 'any' },
  { key: 'start', label: 'start', kind: 'num', step: '1', min: 0 },
  { key: 'end', label: 'end', kind: 'num', step: '1', min: 0 },
];

const HitbubbleRow: React.FC<HitbubbleRowProps> = ({
  index,
  hb,
  active,
  followOptions,
  onSelect,
  onChange,
  onRemove,
}) => {
  const set = <K extends string>(k: K, v: unknown) => {
    if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) {
      delete hb[k];
    } else {
      hb[k] = v;
    }
    onChange();
  };

  // Audio can be a plain cue-name string or an object { name, pitch, volume }.
  // Edit the name in place so the object form's pitch/volume survive edits.
  const audioObj =
    hb.audio && typeof hb.audio === 'object'
      ? (hb.audio as { name?: string; pitch?: number; volume?: number })
      : null;
  const audioName = audioObj ? (audioObj.name ?? '') : typeof hb.audio === 'string' ? hb.audio : '';
  const setAudio = (v: string) => {
    if (audioObj) {
      if (!v) delete hb.audio;
      else audioObj.name = v;
    } else if (!v) {
      delete hb.audio;
    } else {
      hb.audio = v;
    }
    onChange();
  };

  // Read flags from any authored form (number bitmask, string, or string[]).
  const flags = flagsToNames(hb.flags);
  const setFlag = (name: string, on: boolean) => {
    const next = new Set(flags);
    if (on) next.add(name);
    else next.delete(name);
    const arr = [...next];
    // Write back as a readable name array (the form most shipped data uses);
    // unknown names already in `flags` are carried along.
    if (arr.length === 0) delete hb.flags;
    else hb.flags = arr;
    onChange();
  };

  const typeColor = HitbubbleColors[hb.type as string] ?? HitbubbleColors.none;

  return (
    <div
      className={`hbCard ${active ? 'active' : ''}`}
      onMouseDown={onSelect}
      style={{ borderLeft: `3px solid ${typeColor}` }}
    >
      <div className="hbCardHead">
        <span className="hbCardIdx">#{index}</span>
        <select
          value={(hb.type as string) ?? 'ground'}
          onChange={(e) => set('type', e.target.value)}
          title="Hitbubble type"
        >
          {HitbubbleTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          list={`hb-follow-${index}`}
          placeholder="follow…"
          value={(hb.follow as string) ?? ''}
          onChange={(e) => set('follow', e.target.value)}
          title="Bone or named bubble to anchor to"
        />
        <datalist id={`hb-follow-${index}`}>
          {followOptions.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <button
          className="propBtn"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove hitbubble"
        >
          ×
        </button>
      </div>
      <div className="hbCardGrid">
        {FIELD_DEFS.map((f) => (
          <label key={f.key} className="hbField" title={f.label}>
            <span>{f.label}</span>
            <input
              type="number"
              step={f.step ?? '0.1'}
              value={(hb[f.key] as number | undefined) ?? ''}
              onChange={(e) =>
                set(f.key, e.target.value === '' ? undefined : parseFloat(e.target.value))
              }
            />
          </label>
        ))}
      </div>
      <div className="hbCardRow">
        <label className="hbToggle">
          <input
            type="checkbox"
            checked={!!hb.sakurai}
            onChange={(e) => set('sakurai', e.target.checked || undefined)}
          />
          <span>sakurai</span>
        </label>
        <label className="hbToggle">
          <input
            type="checkbox"
            checked={!!hb.strong}
            onChange={(e) => set('strong', e.target.checked || undefined)}
          />
          <span>strong</span>
        </label>
        <label
          className="hbField"
          title={
            audioObj
              ? `Audio cue name (pitch ${audioObj.pitch ?? 1}, volume ${audioObj.volume ?? 1} preserved)`
              : 'Audio cue name'
          }
        >
          <span>audio{audioObj ? ' ♪' : ''}</span>
          <input
            type="text"
            placeholder="hit / grab / …"
            value={audioName}
            onChange={(e) => setAudio(e.target.value)}
          />
        </label>
      </div>
      <div className="hbFlags">
        {HitbubbleFlags.map((f) => (
          <label key={f.name} className="hbFlag" title={f.desc}>
            <input
              type="checkbox"
              checked={flags.includes(f.name)}
              onChange={(e) => setFlag(f.name, e.target.checked)}
            />
            <span>{f.name}</span>
          </label>
        ))}
      </div>
      {/* Long-tail engine fields (effect, if, next, color, …) that don't have
          dedicated controls — editable here so every field is reachable. */}
      <div className="hbExtra" onMouseDown={(e) => e.stopPropagation()}>
        <div className="hbExtraLabel">other</div>
        <PropertiesEditor
          obj={hb as unknown as React.ComponentProps<typeof PropertiesEditor>['obj']}
          hideKeys={HANDLED_KEYS}
          suggestions={EXTRA_FIELD_SUGGESTIONS}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export const HitbubbleEditor: React.FC<HitbubbleEditorProps> = ({
  character,
  animation,
  keyframe,
  selectedHitbubble,
  onSelect,
  onChange,
}) => {
  const kf: Keyframe | undefined = animation.keyframes[keyframe];
  const followOptions = useMemo(() => [...followCandidates(character)].sort(), [character]);
  const [showRaw, setShowRaw] = useState(false);

  if (!kf) return null;

  // hitbubbles can be: undefined, an array, or `true` (continuation).
  const isContinuation = kf.hitbubbles === true;
  const list: Hitbubble[] = Array.isArray(kf.hitbubbles) ? kf.hitbubbles : [];

  const setContinuation = (on: boolean) => {
    if (on) {
      kf.hitbubbles = true;
    } else {
      delete kf.hitbubbles;
    }
    onChange();
  };

  const startList = () => {
    kf.hitbubbles = [NewHitbubbleDefaults()];
    onSelect(0);
    onChange();
  };

  const addRow = () => {
    const arr = Array.isArray(kf.hitbubbles) ? kf.hitbubbles : [];
    arr.push(NewHitbubbleDefaults());
    kf.hitbubbles = arr;
    onSelect(arr.length - 1);
    onChange();
  };

  const removeRow = (i: number) => {
    if (!Array.isArray(kf.hitbubbles)) return;
    kf.hitbubbles.splice(i, 1);
    if (kf.hitbubbles.length === 0) delete kf.hitbubbles;
    onSelect(-1);
    onChange();
  };

  return (
    <div className="hbList">
      <div className="hbToolbar">
        <label className="hbToggle" title="Reuse previous keyframe's hitbubbles">
          <input
            type="checkbox"
            checked={isContinuation}
            disabled={list.length > 0}
            onChange={(e) => setContinuation(e.target.checked)}
          />
          <span>continue (←)</span>
        </label>
        <button className="btn ghost" onClick={() => setShowRaw((v) => !v)} title="Toggle raw JSON">
          {showRaw ? 'hide raw' : 'raw'}
        </button>
        <div style={{ flex: 1 }} />
        {list.length === 0 && !isContinuation && (
          <button className="btn" onClick={startList} title="Add first hitbubble">
            + add hitbox
          </button>
        )}
        {list.length > 0 && (
          <button className="btn" onClick={addRow} title="Add another hitbubble">
            +
          </button>
        )}
      </div>
      {isContinuation && (
        <div className="listEmpty" style={{ padding: '4px 0' }}>
          Inheriting hitbubbles from the previous keyframe.
        </div>
      )}
      {!isContinuation && list.length === 0 && (
        <div className="listEmpty" style={{ padding: '4px 0' }}>
          No hitbubbles. Click <strong>+ add hitbox</strong> to start one.
        </div>
      )}
      {list.map((hb, i) => (
        <HitbubbleRow
          key={i}
          index={i}
          hb={hb}
          active={i === selectedHitbubble}
          followOptions={followOptions}
          onSelect={() => onSelect(i)}
          onChange={onChange}
          onRemove={() => removeRow(i)}
        />
      ))}
      {showRaw && (
        <pre
          className="hbRaw"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            padding: 6,
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--fg-dim)',
            overflow: 'auto',
            maxHeight: 200,
          }}
        >
          {JSON.stringify(kf.hitbubbles, null, 2)}
        </pre>
      )}
    </div>
  );
};
