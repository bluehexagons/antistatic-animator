import React, { useMemo } from 'react';
import type { Animation, EntityData } from '../animator/types';
import { boneModelLabel } from '../animator/rendering/character-info';
import { HURTBUBBLE_MODEL_TRANSFORM_FIELDS } from '../animator/operations/model-transforms';
import {
  authoredModelTransformFrame,
  ensureModelTransformObject,
  keyframeHasModelTransforms,
  modelTransformDefaults,
  setModelTransformObjectValue,
} from '../animator/operations/model-transform-timeline';

export interface ModelTransformEditorProps {
  character: EntityData;
  animation: Animation;
  keyframe: number;
  onChange: () => void;
}

const displayValue = (frame: number[], boneIndex: number, field: 'x' | 'y' | 'rotation') => {
  const offset = boneIndex * HURTBUBBLE_MODEL_TRANSFORM_FIELDS;
  if (field === 'x') return frame[offset] ?? 0;
  if (field === 'y') return -(frame[offset + 1] ?? 0);
  return frame[offset + 2] ?? 0;
};

export const ModelTransformEditor: React.FC<ModelTransformEditorProps> = ({
  character,
  animation,
  keyframe,
  onChange,
}) => {
  const kf = animation.keyframes[keyframe];
  const defaults = useMemo(() => modelTransformDefaults(character), [character]);
  const hasAnchor = keyframeHasModelTransforms(kf);
  const isContinuation = kf?.hurtbubbleModelTransforms === true;
  const frame = useMemo(
    () => authoredModelTransformFrame(animation, character, keyframe, defaults) ?? defaults,
    [animation, character, keyframe, defaults]
  );
  const attachedCount = character.hurtbubbles.filter((bone) => boneModelLabel(bone)).length;

  if (!kf) {
    return <div className="listEmpty">This animation has no keyframe at this index</div>;
  }

  const addAnchor = () => {
    kf.hurtbubbleModelTransforms = ensureModelTransformObject(animation, character, keyframe);
    onChange();
  };

  const continuePrevious = () => {
    kf.hurtbubbleModelTransforms = true;
    onChange();
  };

  const removeAnchor = () => {
    delete kf.hurtbubbleModelTransforms;
    onChange();
  };

  const setField = (boneIndex: number, field: 'x' | 'y' | 'rotation', value: string) => {
    const parsed = Number.parseFloat(value);
    setModelTransformObjectValue(
      animation,
      character,
      keyframe,
      boneIndex,
      field,
      Number.isFinite(parsed) ? parsed : 0
    );
    onChange();
  };

  return (
    <div>
      <div className="modelTransformToolbar">
        <button className="miniButton" type="button" onClick={addAnchor}>
          {hasAnchor && !isContinuation ? 'Edit anchor' : 'Add anchor'}
        </button>
        <button className="miniButton" type="button" onClick={continuePrevious}>
          Continue previous
        </button>
        {hasAnchor && (
          <button className="miniButton danger" type="button" onClick={removeAnchor}>
            Remove
          </button>
        )}
      </div>
      <div className="modelTransformHint">
        {hasAnchor
          ? isContinuation
            ? 'This keyframe continues the previous model-transform anchor. Editing a value converts it to an object anchor.'
            : 'This keyframe is a model-transform anchor. Values are saved in author-space; the engine flips y on load.'
          : 'No model-transform anchor on this keyframe. Add one to animate attached model offsets or rotations.'}
        {attachedCount === 0 ? ' No bones on this character currently declare prefab models.' : ''}
      </div>
      <div className="modelTransformHeader">
        <span className="idx">#</span>
        <span>bone</span>
        <span>x</span>
        <span>y</span>
        <span>rot</span>
        <span>model</span>
      </div>
      <div className="modelTransformList">
        {character.hurtbubbles.map((bone, i) => {
          const model = boneModelLabel(bone);
          return (
            <div key={i} className={`modelTransformRow ${model ? 'hasModel' : ''}`}>
              <span className="idx">{i}</span>
              <span className="boneName" title={bone.name}>
                {bone.name || `bone ${i}`}
              </span>
              {(['x', 'y', 'rotation'] as const).map((field) => (
                <input
                  key={field}
                  type="number"
                  step="any"
                  value={displayValue(frame, i, field)}
                  onChange={(e) => setField(i, field, e.target.value)}
                />
              ))}
              <span className="modelName" title={model ?? 'No attached prefab model'}>
                {model ?? '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
