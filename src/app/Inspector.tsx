/**
 * Inspector — right-hand properties panel.
 *
 * Sections: Animation properties · Stats · Keyframe properties · Hitbubbles · Hurtbubbles.
 */

import React, { useMemo, useState } from 'react';
import type { Animation, EntityData } from '../animator/types';
import { PropertiesEditor } from './PropertiesEditor';
import { BubbleEditor } from './BubbleEditor';
import { HitbubbleEditor } from './HitbubbleEditor';
import { lintAnimation } from '../animator/lint';
import { objHas } from '../utils';

export interface InspectorProps {
  character: EntityData;
  animation: Animation;
  keyframe: number;
  selectedBubble: number;
  onSelectBubble: (i: number) => void;
  selectedHitbubble: number;
  onSelectHitbubble: (i: number) => void;
  onAnimationChange: () => void;
}

interface SectionProps {
  title: string;
  count?: string | number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, count, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <div className={`sectionHeader ${open ? '' : 'collapsed'}`} onClick={() => setOpen(!open)}>
        <span className="caret">▼</span>
        {title}
        {count !== undefined && <span className="sectionCount">{count}</span>}
      </div>
      {open && <div className="sectionBody">{children}</div>}
    </div>
  );
};

const calcStats = (animation: Animation) => {
  const kfs = animation.keyframes;
  let total = 0;
  let windup = 0;
  let backswing = 0;
  let frame = 0;
  let kfn = 0;
  for (; kfn < kfs.length - 1; kfn++) {
    if (objHas(kfs[kfn], 'hitbubbles')) break;
    frame += kfs[kfn].duration ?? 0;
    windup += kfs[kfn].duration ?? 0;
  }
  const hitTimings: string[] = [];
  let lastHB = kfn;
  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn];
    frame += kf.duration ?? 0;
    if (objHas(kf, 'hitbubbles')) {
      lastHB = kfn;
      hitTimings.push(`${frame - (kf.duration ?? 0) + 1}-${frame}`);
    }
  }
  for (kfn = lastHB + 1; kfn < kfs.length - 1; kfn++) {
    backswing += kfs[kfn].duration ?? 0;
  }
  for (let i = 0; i < kfs.length - 1; i++) total += kfs[i].duration ?? 0;
  const hits = hitTimings.join(', ');
  if (objHas(animation, 'iasa')) {
    const iasa = animation.iasa as number;
    backswing -= iasa;
    total -= iasa;
  }
  return { total, windup, hits, backswing };
};

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      padding: '2px 0',
    }}
  >
    <span style={{ color: 'var(--fg-mute)' }}>{label}</span>
    <span style={{ color: 'var(--fg)' }}>{value}</span>
  </div>
);

export const Inspector: React.FC<InspectorProps> = ({
  character,
  animation,
  keyframe,
  selectedBubble,
  onSelectBubble,
  selectedHitbubble,
  onSelectHitbubble,
  onAnimationChange,
}) => {
  const kf = animation.keyframes[keyframe];
  const stats = calcStats(animation);
  const hitCount = Array.isArray(kf?.hitbubbles)
    ? kf.hitbubbles.length
    : kf?.hitbubbles === true
      ? '↩'
      : 0;
  const issues = useMemo(() => lintAnimation(character, animation), [character, animation]);
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  const issueCount = errorCount + warnCount;
  const issueLabel = issueCount > 0 ? `${errorCount}🛑 ${warnCount}⚠` : 'clean';

  return (
    <aside className="inspector">
      <Section title="Issues" count={issueLabel} defaultOpen={errorCount > 0}>
        {issues.length === 0 ? (
          <div style={{ color: 'var(--fg-mute)', fontSize: 11 }}>
            No issues found. Lint runs locally; engine validation is still authoritative.
          </div>
        ) : (
          <div className="lintList">
            {issues.map((iss, idx) => (
              <div key={idx} className={`lintItem lint-${iss.severity}`} title={iss.message}>
                <span className="lintSev">
                  {iss.severity === 'error' ? '🛑' : iss.severity === 'warn' ? '⚠' : 'ℹ'}
                </span>
                {iss.keyframe >= 0 && <span className="lintKf">kf {iss.keyframe}</span>}
                <span className="lintMsg">{iss.message}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Animation" count={`${animation.keyframes.length} kf`}>
        <PropertiesEditor obj={animation} onChange={onAnimationChange} />
      </Section>
      <Section title="Stats">
        <Stat label="duration" value={`${stats.total}f`} />
        <Stat label="windup" value={`${stats.windup}f`} />
        <Stat label="hits" value={stats.hits || '—'} />
        <Stat label="backswing" value={`${stats.backswing}f`} />
      </Section>
      {kf ? (
        <>
          <Section title={`Keyframe #${keyframe}`}>
            <PropertiesEditor obj={kf} isKeyframe onChange={onAnimationChange} />
          </Section>
          <Section title="Hitbubbles" count={hitCount} defaultOpen={!!hitCount}>
            <HitbubbleEditor
              character={character}
              animation={animation}
              keyframe={keyframe}
              selectedHitbubble={selectedHitbubble}
              onSelect={onSelectHitbubble}
              onChange={onAnimationChange}
            />
          </Section>
          <Section
            title="Hurtbubbles"
            count={
              kf.hurtbubbles && Array.isArray(kf.hurtbubbles)
                ? Math.floor(kf.hurtbubbles.length / 4)
                : 0
            }
          >
            <BubbleEditor
              character={character}
              animation={animation}
              keyframe={keyframe}
              selectedBubble={selectedBubble}
              onSelectBubble={onSelectBubble}
              onChange={onAnimationChange}
            />
            <div style={{ fontSize: 10, color: 'var(--fg-mute)', marginTop: 6, lineHeight: 1.5 }}>
              Bones: <strong style={{ color: 'var(--fg)' }}>{character.hurtbubbles.length}</strong>
              {' · '}
              Use <kbd>WASD</kbd>/arrows to nudge (shift = ×5, alt = 0.1).
              {' · '}
              Marquee-drag empty space to multi-select; <kbd>shift</kbd>-click toggles members.
            </div>
          </Section>
        </>
      ) : (
        <Section title="Keyframe" count="missing">
          <div style={{ color: 'var(--fg-mute)', fontSize: 11 }}>
            This animation has no keyframe at the selected index.
          </div>
        </Section>
      )}
    </aside>
  );
};
