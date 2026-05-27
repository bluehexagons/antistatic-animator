/**
 * Timeline — keyframe strip at the bottom of the screen with playback.
 *
 * Owns the playback rAF loop and emits (keyframe, tick) outward via
 * callbacks so the stage viewer can interpolate the pose. Click/drag
 * inside the strip scrubs the playhead.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Animation, EntityData } from '../animator/types';
import { objHas } from '../utils';
import { cloneKeyframe } from '../animator/operations/keyframe-ops';
import { mirrorAnimation } from '../animator/operations/mirror';
import {
  copyKeyframe,
  hasClipboardKeyframe,
  pasteKeyframe,
} from '../animator/operations/clipboard';
import { ensureBaseline, isKeyframeModified } from '../animator/operations/diff';
import { ThumbnailPreview } from './ThumbnailPreview';

export type LoopMode = 'once' | 'loop' | 'ping-pong';

export interface TimelineProps {
  character: EntityData;
  animation: Animation;
  keyframe: number;
  onKeyframeSelect: (i: number) => void;
  onAnimationChange: () => void;
  playing: boolean;
  onPlayingChange: (p: boolean) => void;
  tick: number;
  onTickChange: (t: number) => void;
  loopMode: LoopMode;
  onLoopModeChange: (m: LoopMode) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  character,
  animation,
  keyframe,
  onKeyframeSelect,
  onAnimationChange,
  playing,
  onPlayingChange,
  tick,
  onTickChange,
  loopMode,
  onLoopModeChange,
}) => {
  const total = useMemo(
    () => animation.keyframes.reduce((s, k) => s + (k.duration ?? 0), 0),
    [animation]
  );

  // Snapshot the keyframes for session diff tracking (idempotent per array).
  ensureBaseline(animation.keyframes);
  const [clipReady, setClipReady] = useState(hasClipboardKeyframe());

  const copyAt = (i: number) => {
    copyKeyframe(animation.keyframes[i]);
    setClipReady(true);
  };
  const pasteAfter = (i: number) => {
    const kf = pasteKeyframe();
    if (!kf) return;
    animation.keyframes.splice(i + 1, 0, kf);
    onAnimationChange();
    onKeyframeSelect(i + 1);
  };

  // Animation loop. Direction = +1 normally, flipped for ping-pong reverse leg.
  // We read tick / keyframe through refs so the rAF loop doesn't tear down
  // and restart on every frame.
  const dirRef = useRef(1);
  const tickRef = useRef(tick);
  const keyframeRef = useRef(keyframe);
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);
  useEffect(() => {
    keyframeRef.current = keyframe;
  }, [keyframe]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const fps = 60;
    const tickStep = (now: number) => {
      const dt = ((now - last) / (1000 / fps)) * dirRef.current;
      last = now;
      let nt = tickRef.current + dt;
      let kf = keyframeRef.current;
      let safe = 0;
      while (animation.keyframes[kf] && safe++ < 256) {
        const dur = animation.keyframes[kf].duration ?? 1;
        if (dirRef.current > 0) {
          if (nt < dur) break;
          nt -= dur;
          kf = kf + 1;
          if (kf >= animation.keyframes.length) {
            if (loopMode === 'loop') kf = 0;
            else if (loopMode === 'ping-pong') {
              dirRef.current = -1;
              kf = animation.keyframes.length - 1;
              nt = (animation.keyframes[kf].duration ?? 1) - 0.0001;
            } else {
              onPlayingChange(false);
              kf = animation.keyframes.length - 1;
              nt = 0;
              break;
            }
          }
        } else {
          if (nt >= 0) break;
          kf = kf - 1;
          if (kf < 0) {
            if (loopMode === 'ping-pong') {
              dirRef.current = 1;
              kf = 0;
              nt = 0;
            } else if (loopMode === 'loop') {
              kf = animation.keyframes.length - 1;
              nt = (animation.keyframes[kf].duration ?? 1) - 0.0001;
            } else {
              onPlayingChange(false);
              kf = 0;
              nt = 0;
              break;
            }
          } else {
            nt += animation.keyframes[kf].duration ?? 1;
          }
        }
      }
      tickRef.current = nt;
      if (kf !== keyframeRef.current) {
        keyframeRef.current = kf;
        onKeyframeSelect(kf);
      }
      onTickChange(nt);
      raf = requestAnimationFrame(tickStep);
    };
    raf = requestAnimationFrame(tickStep);
    return () => cancelAnimationFrame(raf);
  }, [playing, animation.keyframes, loopMode, onPlayingChange, onKeyframeSelect, onTickChange]);

  const cumulativeFrame = useMemo(() => {
    let f = 0;
    for (let i = 0; i < keyframe; i++) f += animation.keyframes[i].duration ?? 0;
    return Math.floor(f + tick);
  }, [keyframe, tick, animation.keyframes]);

  const step = (delta: number) => {
    const i = keyframe + delta;
    if (i < 0 || i >= animation.keyframes.length) return;
    onKeyframeSelect(i);
    onTickChange(0);
  };

  const cloneAt = (i: number, side: 'left' | 'right') => {
    const src = cloneKeyframe(animation.keyframes[i]);
    animation.keyframes.splice(side === 'left' ? i : i + 1, 0, src);
    onAnimationChange();
    onKeyframeSelect(side === 'left' ? i : i + 1);
  };
  const swap = (i: number, side: 'left' | 'right') => {
    const j = side === 'left' ? i - 1 : i + 1;
    if (j < 0 || j >= animation.keyframes.length) return;
    const tmp = animation.keyframes[i];
    animation.keyframes[i] = animation.keyframes[j];
    animation.keyframes[j] = tmp;
    onAnimationChange();
    onKeyframeSelect(j);
  };
  const remove = (i: number) => {
    if (animation.keyframes.length <= 1) return;
    animation.keyframes.splice(i, 1);
    onAnimationChange();
    onKeyframeSelect(Math.max(0, i - 1));
  };

  // Scrub support: pointerdown on the strip background (not on a thumb) sets
  // keyframe+tick to the point under the cursor.
  const stripRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef(false);

  const scrubTo = (clientX: number) => {
    if (!stripRef.current) return;
    const thumbs = stripRef.current.querySelectorAll<HTMLElement>('[data-kf]');
    if (!thumbs.length) return;
    const stripRect = stripRef.current.getBoundingClientRect();
    const localX = clientX - stripRect.left;
    for (let i = 0; i < thumbs.length; i++) {
      const el = thumbs[i];
      const r = el.getBoundingClientRect();
      const left = r.left - stripRect.left;
      const right = r.right - stripRect.left;
      if (localX >= left && localX <= right) {
        const fraction = (localX - left) / Math.max(1, right - left);
        const kfIdx = parseInt(el.dataset.kf || '0', 10);
        const dur = animation.keyframes[kfIdx].duration ?? 1;
        onKeyframeSelect(kfIdx);
        onTickChange(fraction * dur);
        return;
      }
    }
  };

  const onStripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Only scrub on background; bail if clicking inside a thumb (it handles its own click).
    const t = e.target as HTMLElement;
    if (t.closest('[data-kf]') || t.closest('.kfActions')) return;
    scrubRef.current = true;
    stripRef.current?.setPointerCapture(e.pointerId);
    scrubTo(e.clientX);
  };
  const onStripPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubRef.current) return;
    scrubTo(e.clientX);
  };
  const onStripPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubRef.current) return;
    scrubRef.current = false;
    stripRef.current?.releasePointerCapture(e.pointerId);
  };

  // Playhead position
  const [playhead, setPlayhead] = useState<number | null>(null);
  useEffect(() => {
    if (!stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(`[data-kf="${keyframe}"]`);
    if (!el) return;
    const stripRect = stripRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const progress = Math.min(1, tick / Math.max(1, animation.keyframes[keyframe].duration ?? 1));
    const x = elRect.left - stripRect.left + elRect.width * progress + stripRef.current.scrollLeft;
    setPlayhead(x);
  }, [keyframe, tick, animation.keyframes]);

  return (
    <div className="timeline">
      <div className="timelineHeader">
        <div className="transport">
          <button onClick={() => step(-1)} title="Previous keyframe ( , )" disabled={keyframe <= 0}>
            ⏮
          </button>
          <button
            onClick={() => onPlayingChange(!playing)}
            className={playing ? 'playing' : ''}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => step(1)}
            title="Next keyframe ( . )"
            disabled={keyframe >= animation.keyframes.length - 1}
          >
            ⏭
          </button>
        </div>
        <select
          className="loopSelect"
          value={loopMode}
          onChange={(e) => onLoopModeChange(e.target.value as LoopMode)}
          title="Loop mode"
        >
          <option value="loop">↻ loop</option>
          <option value="once">→ once</option>
          <option value="ping-pong">⇄ ping-pong</option>
        </select>
        <div className="frameCounter">
          <span className="label">frame</span>
          <strong>{cumulativeFrame}</strong>
          <span className="label">/ {total}</span>
        </div>
        <div className="frameCounter">
          <span className="label">kf</span>
          <strong>{keyframe + 1}</strong>
          <span className="label">/ {animation.keyframes.length}</span>
        </div>
        <div className="grow" />
        <button
          className="btn ghost"
          title="Copy the current keyframe to the clipboard (reusable across animations)"
          onClick={() => copyAt(keyframe)}
        >
          ⧉ Copy
        </button>
        <button
          className="btn ghost"
          title="Paste copied keyframe after the current one"
          disabled={!clipReady}
          onClick={() => pasteAfter(keyframe)}
        >
          ⎙ Paste
        </button>
        <button
          className="btn ghost"
          title="Mirror the whole animation horizontally (flip-X). Reversible — click again to undo."
          onClick={() => {
            mirrorAnimation(character, animation);
            onAnimationChange();
          }}
        >
          ⇄ Mirror
        </button>
        <button
          className="btn ghost"
          title="Append a copy of the last keyframe"
          onClick={() => {
            const last = animation.keyframes.length - 1;
            const src = cloneKeyframe(animation.keyframes[last]);
            animation.keyframes.push(src);
            onAnimationChange();
            onKeyframeSelect(animation.keyframes.length - 1);
          }}
        >
          + Add keyframe
        </button>
      </div>
      <div
        className="timelineStrip"
        ref={stripRef}
        onPointerDown={onStripPointerDown}
        onPointerMove={onStripPointerMove}
        onPointerUp={onStripPointerUp}
        onPointerCancel={onStripPointerUp}
      >
        {animation.keyframes.map((kf, i) => {
          const active = i === keyframe;
          const width = Math.max(70, Math.min(140, 64 + (kf.duration ?? 1) * 4));
          const hasHits = objHas(kf, 'hitbubbles');
          const tween = (kf as { tween?: string }).tween;
          const modified = isKeyframeModified(animation.keyframes, kf);
          return (
            <div
              key={i}
              data-kf={i}
              className={`kfThumb ${active ? 'active' : ''} ${modified ? 'modified' : ''}`}
              onClick={() => {
                onKeyframeSelect(i);
                onTickChange(0);
              }}
              style={{ width }}
            >
              <div className="kfBadges">
                {modified && (
                  <span className="kfBadge mod" title="Modified this session (unsaved)">
                    ●
                  </span>
                )}
                {hasHits && <span className="kfBadge hit">HIT</span>}
                {tween && tween !== 'linear' && (
                  <span className="kfBadge">{String(tween).slice(0, 6)}</span>
                )}
                {(kf as { interpolate?: boolean }).interpolate && (
                  <span className="kfBadge" title="Interpolated">
                    ~
                  </span>
                )}
              </div>
              <div className="kfPreview">
                <ThumbnailPreview character={character} animation={animation} keyframeIndex={i} />
              </div>
              <div className="kfMeta">
                <span className="num">#{i}</span>
                <span className="dur">{kf.duration ?? 0}f</span>
              </div>
              {active && (
                <div className="kfActions">
                  <button onClick={(e) => (e.stopPropagation(), swap(i, 'left'))} title="Swap left">
                    ⇐
                  </button>
                  <button
                    onClick={(e) => (e.stopPropagation(), swap(i, 'right'))}
                    title="Swap right"
                  >
                    ⇒
                  </button>
                  <button onClick={(e) => (e.stopPropagation(), cloneAt(i, 'right'))} title="Clone">
                    ⎘
                  </button>
                  <button onClick={(e) => (e.stopPropagation(), remove(i))} title="Delete">
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <button
          className="kfAdd"
          title="Add new keyframe"
          onClick={() => {
            const last = animation.keyframes.length - 1;
            const src = cloneKeyframe(animation.keyframes[last]);
            animation.keyframes.push(src);
            onAnimationChange();
            onKeyframeSelect(animation.keyframes.length - 1);
          }}
        >
          +
        </button>
        {playhead !== null && <div className="timelinePlayhead" style={{ left: playhead }} />}
      </div>
    </div>
  );
};
