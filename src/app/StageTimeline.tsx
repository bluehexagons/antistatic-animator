import React, { useEffect, useRef } from 'react';
import { sampleStagePosition, stageAnimationDuration } from '../stage/animation';
import type { StageDocument, StageSelection, Vec2, Vec3 } from '../stage/types';

interface StageTimelineProps {
  stage: StageDocument;
  selection: StageSelection;
  frame: number;
  playing: boolean;
  onFrameChange: (frame: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onChange: () => void;
}

const initialPosition = (
  stage: StageDocument,
  kind: 'model' | 'collision',
  id: string
): Vec2 | Vec3 => {
  if (kind === 'model') {
    return [...(stage.scene.models?.find((model) => model.id === id)?.position ?? [0, 0, 0])];
  }
  return [...(stage.scene.collision?.find((collision) => collision.id === id)?.from ?? [0, 0])];
};

const targetValue = (target: { kind: 'model' | 'collision'; id: string }) =>
  JSON.stringify([target.kind, target.id]);

export const StageTimeline: React.FC<StageTimelineProps> = ({
  stage,
  selection,
  frame,
  playing,
  onFrameChange,
  onPlayingChange,
  onChange,
}) => {
  const animation =
    selection.kind === 'animation'
      ? stage.scene.animations?.find((item) => item.id === selection.id)
      : undefined;
  const targets = [
    ...(stage.scene.models ?? []).map((model) => ({ kind: 'model' as const, id: model.id })),
    ...(stage.scene.collision ?? []).map((collision) => ({
      kind: 'collision' as const,
      id: collision.id,
    })),
  ];
  const duration = animation ? stageAnimationDuration(animation) : 1;
  const lastFrame = Math.max(0, duration - 1);
  const hasAvailableTarget = targets.some(
    (target) =>
      !animation?.tracks.some(
        (track) => track.target.kind === target.kind && track.target.id === target.id
      )
  );
  const frameRef = useRef(frame);
  const directionRef = useRef(1);
  frameRef.current = frame;

  useEffect(() => {
    directionRef.current = (animation?.speed ?? 1) < 0 ? -1 : 1;
  }, [animation?.id, animation?.speed]);

  useEffect(() => {
    if (!animation || !playing) return;
    let request = 0;
    let previousTime: number | undefined;
    const step = (time: number) => {
      if (previousTime === undefined) previousTime = time;
      const elapsedFrames = ((time - previousTime) / 1000) * 60 * Math.abs(animation.speed ?? 1);
      previousTime = time;
      let next = frameRef.current + elapsedFrames * directionRef.current;
      if (directionRef.current > 0 && next >= lastFrame) {
        if (animation.pingPong && lastFrame > 0) {
          next = Math.max(0, lastFrame - (next - lastFrame));
          directionRef.current = -1;
        } else if (animation.loop && duration > 0) {
          next %= duration;
        } else {
          next = lastFrame;
          onPlayingChange(false);
        }
      } else if (directionRef.current < 0 && next <= 0) {
        if (animation.pingPong && animation.loop && lastFrame > 0) {
          next = Math.min(lastFrame, -next);
          directionRef.current = 1;
        } else {
          next = 0;
          onPlayingChange(false);
        }
      }
      frameRef.current = next;
      onFrameChange(next);
      request = requestAnimationFrame(step);
    };
    request = requestAnimationFrame(step);
    return () => cancelAnimationFrame(request);
  }, [animation, duration, lastFrame, onFrameChange, onPlayingChange, playing]);

  if (!animation) {
    return (
      <div className="timeline stageTimelineEmpty">
        Select an animation in the scene list to edit its tracks and keyframes.
      </div>
    );
  }

  const addTrack = () => {
    const target = targets.find(
      (candidate) =>
        !animation.tracks.some(
          (track) => track.target.kind === candidate.kind && track.target.id === candidate.id
        )
    );
    if (!target) return;
    if (
      animation.tracks.some(
        (track) => track.target.kind === target.kind && track.target.id === target.id
      )
    ) {
      return;
    }
    animation.tracks.push({
      target: { ...target },
      keyframes: [{ time: 0, position: initialPosition(stage, target.kind, target.id) }],
    });
    onChange();
  };

  return (
    <div className="timeline stageTimeline">
      <div className="timelineHeader">
        <strong>{animation.id}</strong>
        <div className="transport">
          <button
            type="button"
            className="miniAction"
            aria-label={playing ? 'Pause stage animation' : 'Play stage animation'}
            title={playing ? 'Pause' : 'Play'}
            onClick={() => {
              if (!playing && (frame >= lastFrame || frame <= 0)) {
                onFrameChange((animation.speed ?? 1) < 0 ? lastFrame : 0);
              }
              onPlayingChange(!playing);
            }}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            className="miniAction"
            aria-label="Go to first frame"
            title="First frame"
            onClick={() => onFrameChange(0)}
          >
            |◀
          </button>
        </div>
        <input
          className="stageScrubber"
          type="range"
          min="0"
          max={lastFrame}
          step="0.01"
          value={Math.min(frame, lastFrame)}
          aria-label="Animation frame"
          onChange={(event) => {
            onPlayingChange(false);
            onFrameChange(Number(event.target.value));
          }}
        />
        <label className="stageFrameField">
          frame
          <input
            type="number"
            min="0"
            max={lastFrame}
            step="0.01"
            value={Number(Math.min(frame, lastFrame).toFixed(2))}
            onChange={(event) => {
              onPlayingChange(false);
              onFrameChange(Math.min(lastFrame, Math.max(0, Number(event.target.value) || 0)));
            }}
          />
          / {Number(lastFrame.toFixed(2))}
        </label>
        <span className="grow" />
        <span className="stats">{animation.tracks.length} tracks</span>
        <button className="btn" disabled={!hasAvailableTarget} onClick={addTrack}>
          Add track
        </button>
      </div>
      <div className="stageTrackList">
        {animation.tracks.length === 0 && (
          <div className="stageTimelineEmpty">
            Add a model or collision track to begin animating.
          </div>
        )}
        {animation.tracks.map((track, trackIndex) => (
          <div className="stageTrack" key={`${track.target.kind}:${track.target.id}:${trackIndex}`}>
            <div className="stageTrackHeader">
              <select
                aria-label={`Target for track ${trackIndex + 1}`}
                value={targetValue(track.target)}
                onChange={(event) => {
                  const [kind, id] = JSON.parse(event.target.value) as [
                    'model' | 'collision',
                    string,
                  ];
                  track.target = { kind, id };
                  const dimensions = kind === 'model' ? 3 : 2;
                  track.keyframes = track.keyframes.map((keyframe) => ({
                    ...keyframe,
                    position: initialPosition(stage, kind, id).slice(0, dimensions) as Vec2 | Vec3,
                  }));
                  onChange();
                }}
              >
                {targets.map((target) => (
                  <option key={targetValue(target)} value={targetValue(target)}>
                    {target.kind}: {target.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="miniAction danger"
                aria-label={`Delete track ${trackIndex + 1}`}
                onClick={() => {
                  animation.tracks.splice(trackIndex, 1);
                  onChange();
                }}
                title="Delete track"
              >
                ×
              </button>
            </div>
            <div className="stageKeyframes">
              {track.keyframes.map((keyframe, keyframeIndex) => (
                <div className="stageKeyframe" key={keyframeIndex}>
                  <label>
                    frame
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={keyframe.time}
                      onChange={(event) => {
                        keyframe.time = Math.max(0, Number(event.target.value) || 0);
                        track.keyframes.sort((a, b) => a.time - b.time);
                        onChange();
                      }}
                    />
                  </label>
                  {keyframe.position.map((component, componentIndex) => (
                    <label key={componentIndex}>
                      {'xyz'[componentIndex]}
                      <input
                        type="number"
                        step="any"
                        value={component}
                        onChange={(event) => {
                          keyframe.position[componentIndex] = Number(event.target.value) || 0;
                          onChange();
                        }}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    aria-label={`Delete keyframe ${keyframeIndex + 1} from track ${trackIndex + 1}`}
                    className="miniAction danger"
                    disabled={track.keyframes.length === 1}
                    onClick={() => {
                      track.keyframes.splice(keyframeIndex, 1);
                      onChange();
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const position =
                    sampleStagePosition(track.keyframes, frame) ??
                    initialPosition(stage, track.target.kind, track.target.id);
                  track.keyframes.push({
                    time: frame,
                    position: [...position] as Vec2 | Vec3,
                  });
                  track.keyframes.sort((a, b) => a.time - b.time);
                  onChange();
                }}
              >
                + keyframe at {Number(frame.toFixed(2))}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
