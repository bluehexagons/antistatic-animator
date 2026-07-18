import React from 'react';
import type { StageDocument, StageSelection, Vec2, Vec3 } from '../stage/types';

interface StageTimelineProps {
  stage: StageDocument;
  selection: StageSelection;
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

export const StageTimeline: React.FC<StageTimelineProps> = ({ stage, selection, onChange }) => {
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

  if (!animation) {
    return (
      <div className="timeline stageTimelineEmpty">
        Select an animation in the scene list to edit its tracks and keyframes.
      </div>
    );
  }

  const addTrack = () => {
    const target = targets[0];
    if (!target) return;
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
        <span className="grow" />
        <span className="stats">{animation.tracks.length} tracks</span>
        <button className="btn" disabled={targets.length === 0} onClick={addTrack}>
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
                value={`${track.target.kind}:${track.target.id}`}
                onChange={(event) => {
                  const [kind, id] = event.target.value.split(':') as [
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
                  <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>
                    {target.kind}: {target.id}
                  </option>
                ))}
              </select>
              <button
                className="miniAction danger"
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
                className="btn ghost"
                onClick={() => {
                  const previous = track.keyframes[track.keyframes.length - 1];
                  track.keyframes.push({
                    time: (previous?.time ?? -1) + 1,
                    position: [
                      ...(previous?.position ??
                        initialPosition(stage, track.target.kind, track.target.id)),
                    ] as Vec2 | Vec3,
                  });
                  onChange();
                }}
              >
                + keyframe
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
