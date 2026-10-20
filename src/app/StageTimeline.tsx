import React, { useEffect, useRef, useState } from 'react';
import {
  sampleStagePosition,
  sampleStageMaterial,
  stageAnimationDuration,
} from '../stage/animation';
import type {
  StageAnimationTrack,
  StageDocument,
  StageSelection,
  Vec2,
  Vec3,
} from '../stage/types';
import { isStageMaterialTrack } from '../stage/types';
import { EMISSION_MAX, stageAuthoredEmission, stageMaterialSlots } from '../stage/emission';

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

type Target = StageAnimationTrack['target'];
const targetValue = (target: Target) =>
  JSON.stringify(
    target.kind === 'material'
      ? [target.kind, target.id.trim(), target.materialSlot.trim(), target.property]
      : [target.kind, target.id.trim()]
  );

const initialTrack = (stage: StageDocument, target: Target): StageAnimationTrack => {
  if (target.kind === 'material') {
    const model = stage.scene.models?.find((item) => item.id.trim() === target.id.trim());
    const emission = model
      ? stageAuthoredEmission(stage, model, target.materialSlot)
      : { emissive: [0, 0, 0] as Vec3, emissiveStrength: 1 };
    return {
      target: { ...target, id: target.id.trim(), materialSlot: target.materialSlot.trim() },
      keyframes: [{ time: 0, value: emission[target.property] }],
    };
  }
  return {
    target: { ...target },
    keyframes: [{ time: 0, position: initialPosition(stage, target.kind, target.id) }],
  };
};

export const StageTimeline: React.FC<StageTimelineProps> = ({
  stage,
  selection,
  frame,
  playing,
  onFrameChange,
  onPlayingChange,
  onChange,
}) => {
  const [newTarget, setNewTarget] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customSlot, setCustomSlot] = useState('');
  const [customProperty, setCustomProperty] = useState<'emissive' | 'emissiveStrength'>('emissive');
  const animation =
    selection.kind === 'animation'
      ? stage.scene.animations?.find((item) => item.id === selection.id)
      : undefined;
  const targets: Target[] = [
    ...(stage.scene.models ?? []).map((model) => ({ kind: 'model' as const, id: model.id })),
    ...(stage.scene.collision ?? []).map((collision) => ({
      kind: 'collision' as const,
      id: collision.id,
    })),
    ...(stage.scene.models ?? []).flatMap((model) =>
      stageMaterialSlots(stage, model).flatMap((materialSlot) =>
        (['emissive', 'emissiveStrength'] as const).map((property) => ({
          kind: 'material' as const,
          id: model.id,
          materialSlot,
          property,
        }))
      )
    ),
  ];
  const duration = animation ? stageAnimationDuration(animation) : 1;
  const lastFrame = Math.max(0, duration - 1);
  const availableTargets = targets.filter(
    (target) =>
      !animation?.tracks.some((track) => targetValue(track.target) === targetValue(target))
  );
  const importedModels = (stage.scene.models ?? []).filter((model) => !model.primitive);
  const customModelId =
    importedModels.find((model) => model.id === customModel)?.id ?? importedModels[0]?.id;
  const customMode = newTarget === 'custom-material';
  const chosenNewTarget: Target | undefined = customMode
    ? customModelId && customSlot.trim()
      ? {
          kind: 'material',
          id: customModelId,
          materialSlot: customSlot.trim(),
          property: customProperty,
        }
      : undefined
    : (availableTargets.find((target) => targetValue(target) === newTarget) ?? availableTargets[0]);
  const canAddTrack =
    !!chosenNewTarget &&
    !animation?.tracks.some((track) => targetValue(track.target) === targetValue(chosenNewTarget));
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
    const target = chosenNewTarget;
    if (!target) return;
    if (animation.tracks.some((track) => targetValue(track.target) === targetValue(target))) {
      return;
    }
    animation.tracks.push(initialTrack(stage, target));
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
        <select
          aria-label="New track target"
          value={
            customMode ? 'custom-material' : chosenNewTarget ? targetValue(chosenNewTarget) : ''
          }
          onChange={(event) => setNewTarget(event.target.value)}
          disabled={!availableTargets.length && !importedModels.length}
        >
          {!availableTargets.length && <option value="">All known targets animated</option>}
          {!!importedModels.length && (
            <option value="custom-material">Material: other imported source slot…</option>
          )}
          {availableTargets.map((target) => (
            <option key={targetValue(target)} value={targetValue(target)}>
              {target.kind}: {target.id}
              {target.kind === 'material'
                ? ` / ${target.materialSlot} / ${target.property}`
                : ' / position'}
            </option>
          ))}
        </select>
        {customMode && (
          <div className="stageCustomTrack">
            <select
              aria-label="Model for new material track"
              value={customModelId ?? ''}
              onChange={(event) => setCustomModel(event.target.value)}
            >
              {importedModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))}
            </select>
            <input
              aria-label="Original slot for new material track"
              placeholder="Original mesh slot name"
              value={customSlot}
              onChange={(event) => setCustomSlot(event.target.value)}
            />
            <select
              aria-label="Property for new material track"
              value={customProperty}
              onChange={(event) => setCustomProperty(event.target.value as typeof customProperty)}
            >
              <option value="emissive">Linear RGB</option>
              <option value="emissiveStrength">Strength</option>
            </select>
          </div>
        )}
        <button className="btn" disabled={!canAddTrack} onClick={addTrack}>
          Add track
        </button>
      </div>
      <div className="stageTrackList">
        {animation.tracks.length === 0 && (
          <div className="stageTimelineEmpty">
            Add a position or material emission track. For an imported slot absent from the list,
            choose “other imported source slot” and enter its original asset name.
          </div>
        )}
        {animation.tracks.map((track, trackIndex) => (
          <div className="stageTrack" key={`${track.target.kind}:${track.target.id}:${trackIndex}`}>
            <div className="stageTrackHeader">
              <select
                aria-label={`Target for track ${trackIndex + 1}`}
                value={targetValue(track.target)}
                onChange={(event) => {
                  const target = targets.find(
                    (candidate) => targetValue(candidate) === event.target.value
                  );
                  if (
                    !target ||
                    animation.tracks.some(
                      (other, index) =>
                        index !== trackIndex && targetValue(other.target) === targetValue(target)
                    )
                  )
                    return;
                  const replacement = initialTrack(stage, target);
                  // Keep times when retargeting, resetting values to the new target's authored state.
                  animation.tracks[trackIndex] = isStageMaterialTrack(replacement)
                    ? {
                        ...replacement,
                        keyframes: track.keyframes.map((keyframe) => ({
                          time: keyframe.time,
                          value: structuredClone(replacement.keyframes[0].value),
                        })),
                      }
                    : {
                        ...replacement,
                        keyframes: track.keyframes.map((keyframe) => ({
                          time: keyframe.time,
                          position: [...replacement.keyframes[0].position] as Vec2 | Vec3,
                        })),
                      };
                  onChange();
                }}
              >
                {targets.map((target) => (
                  <option
                    key={targetValue(target)}
                    value={targetValue(target)}
                    disabled={animation.tracks.some(
                      (other, index) =>
                        index !== trackIndex && targetValue(other.target) === targetValue(target)
                    )}
                  >
                    {target.kind}: {target.id}
                    {target.kind === 'material'
                      ? ` / ${target.materialSlot} / ${target.property}`
                      : ' / position'}
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
                        const time = Number(event.target.value);
                        if (
                          !Number.isFinite(time) ||
                          time < 0 ||
                          track.keyframes.some(
                            (other, index) => index !== keyframeIndex && other.time === time
                          )
                        )
                          return;
                        keyframe.time = time;
                        track.keyframes.sort((a, b) => a.time - b.time);
                        onChange();
                      }}
                    />
                  </label>
                  {(isStageMaterialTrack(track)
                    ? Array.isArray(track.keyframes[keyframeIndex].value)
                      ? (track.keyframes[keyframeIndex].value as Vec3)
                      : [track.keyframes[keyframeIndex].value as number]
                    : track.keyframes[keyframeIndex].position
                  ).map((component, componentIndex) => (
                    <label key={componentIndex}>
                      {isStageMaterialTrack(track)
                        ? track.target.property === 'emissive'
                          ? 'RGB'[componentIndex]
                          : 'strength'
                        : 'xyz'[componentIndex]}
                      <input
                        type="number"
                        step="any"
                        value={component}
                        min={isStageMaterialTrack(track) ? 0 : undefined}
                        max={isStageMaterialTrack(track) ? EMISSION_MAX : undefined}
                        aria-label={`Track ${trackIndex + 1} keyframe ${keyframeIndex + 1} component ${componentIndex + 1}`}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (
                            !Number.isFinite(value) ||
                            (isStageMaterialTrack(track) && (value < 0 || value > EMISSION_MAX))
                          )
                            return;
                          if (isStageMaterialTrack(track)) {
                            const key = track.keyframes[keyframeIndex];
                            if (Array.isArray(key.value))
                              key.value = key.value.map((old, index) =>
                                index === componentIndex ? value : old
                              ) as Vec3;
                            else key.value = value;
                          } else track.keyframes[keyframeIndex].position[componentIndex] = value;
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
                disabled={track.keyframes.some((keyframe) => keyframe.time === frame)}
                onClick={() => {
                  if (
                    !Number.isFinite(frame) ||
                    frame < 0 ||
                    track.keyframes.some((keyframe) => keyframe.time === frame)
                  )
                    return;
                  if (isStageMaterialTrack(track)) {
                    const value = sampleStageMaterial(track.keyframes, frame);
                    if (value !== undefined)
                      track.keyframes.push({ time: frame, value: structuredClone(value) });
                  } else {
                    const position =
                      sampleStagePosition(track.keyframes, frame) ??
                      initialPosition(stage, track.target.kind, track.target.id);
                    track.keyframes.push({ time: frame, position: [...position] as Vec2 | Vec3 });
                  }
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
