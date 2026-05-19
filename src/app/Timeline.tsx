/**
 * Timeline — keyframe strip at the bottom of the screen with playback.
 * Each thumbnail shows the keyframe pose and its frame duration.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Animation, EntityData } from '../animator/types';
import { objHas } from '../utils';
import { cloneKeyframe } from '../animator/operations/keyframe-ops';
import { ThumbnailPreview } from './ThumbnailPreview';

export interface TimelineProps {
  character: EntityData;
  animation: Animation;
  keyframe: number;
  onKeyframeSelect: (i: number) => void;
  onAnimationChange: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  character,
  animation,
  keyframe,
  onKeyframeSelect,
  onAnimationChange,
}) => {
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0); // sub-keyframe progress in frames

  const total = useMemo(
    () => animation.keyframes.reduce((s, k) => s + (k.duration ?? 0), 0),
    [animation]
  );

  // Animation loop
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const fps = 60;
    const step = (now: number) => {
      const dt = (now - last) / (1000 / fps);
      last = now;
      setTick((t) => {
        let nt = t + dt;
        // Advance keyframes
        let kf = keyframe;
        let safe = 0;
        while (
          animation.keyframes[kf] &&
          nt >= (animation.keyframes[kf].duration ?? 1) &&
          safe++ < 256
        ) {
          nt -= animation.keyframes[kf].duration ?? 1;
          kf = kf + 1;
          if (kf >= animation.keyframes.length) {
            kf = 0;
          }
        }
        if (kf !== keyframe) {
          onKeyframeSelect(kf);
          return 0;
        }
        return nt;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, keyframe, animation.keyframes, onKeyframeSelect]);

  // Pause when keyframe changes externally (e.g. user click)
  useEffect(() => {
    setTick(0);
  }, [keyframe]);

  const cumulativeFrame = useMemo(() => {
    let f = 0;
    for (let i = 0; i < keyframe; i++) f += animation.keyframes[i].duration ?? 0;
    return Math.floor(f + tick);
  }, [keyframe, tick, animation.keyframes]);

  const step = (delta: number) => {
    const i = keyframe + delta;
    if (i < 0 || i >= animation.keyframes.length) return;
    onKeyframeSelect(i);
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

  // Playhead position within timeline strip
  const stripRef = useRef<HTMLDivElement>(null);
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
          <button onClick={() => step(-1)} title="Previous keyframe (←)" disabled={keyframe <= 0}>
            ⏮
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className={playing ? 'playing' : ''}
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            onClick={() => step(1)}
            title="Next keyframe (→)"
            disabled={keyframe >= animation.keyframes.length - 1}
          >
            ⏭
          </button>
        </div>
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
      <div className="timelineStrip" ref={stripRef}>
        {animation.keyframes.map((kf, i) => {
          const active = i === keyframe;
          const width = Math.max(70, Math.min(140, 64 + (kf.duration ?? 1) * 4));
          const hasHits = objHas(kf, 'hitbubbles');
          return (
            <div
              key={i}
              data-kf={i}
              className={`kfThumb ${active ? 'active' : ''}`}
              onClick={() => onKeyframeSelect(i)}
              style={{ width }}
            >
              <div className="kfBadges">
                {hasHits && <span className="kfBadge hit">HIT</span>}
                {objHas(kf, 'tween') &&
                  (kf as { tween?: string }).tween &&
                  (kf as { tween?: string }).tween !== 'linear' && (
                    <span className="kfBadge">
                      {String((kf as { tween?: string }).tween).slice(0, 6)}
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
