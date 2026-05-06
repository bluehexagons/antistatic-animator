/**
 * KeyframeList Component
 *
 * Renders all keyframes with previews, buttons, and property editors.
 * Replaces the bulk of the DOM building in loadAnimation() from init.ts.
 */

import React from 'react';
import { PropertyEditor } from './PropertyEditor';
import { StatsDisplay } from './StatsDisplay';
import { KeyframeCopier } from './KeyframeCopier';
import { BubblePreview } from './BubblePreview';
import type { EntityData, Animation } from '../types';
import type { CameraState } from '../context/AnimatorContext';

interface KeyframeListProps {
  character: EntityData;
  animation: Animation;
  keyframeIndex: number;
  camera: CameraState;
  onKeyframeSelect: (index: number) => void;
  onAnimationChange: (animation: Animation) => void;
}

export const KeyframeList: React.FC<KeyframeListProps> = ({
  character,
  animation,
  keyframeIndex,
  camera,
  onKeyframeSelect,
  onAnimationChange,
}) => {
  const keyframes = animation.keyframes;

  return (
    <div className="keyframe-list-container">
      {/* Animation-level properties */}
      <div className="animation-properties">
        <PropertyEditor obj={animation} onChange={() => onAnimationChange({ ...animation })} />
      </div>

      {/* Animation stats */}
      <StatsDisplay animation={animation} />

      {/* Keyframes */}
      <div className="keyframes-container">
        {keyframes.map((kf, idx) => (
          <div
            key={`keyframe-${idx}`}
            className={`keyframe-item ${idx === keyframeIndex ? 'highlighted' : ''}`}
            onClick={() => onKeyframeSelect(idx)}
          >
            {/* Keyframe copier buttons */}
            <KeyframeCopier
              animation={animation}
              keyframeIndex={idx}
              onAnimationChange={onAnimationChange}
            />

            {/* Bubble preview */}
            {kf.hurtbubbles && Array.isArray(kf.hurtbubbles) && kf.hurtbubbles.length > 0 && (
              <BubblePreview
                character={character}
                animation={animation}
                keyframeIndex={idx}
                camera={camera}
                onSelect={() => onKeyframeSelect(idx)}
              />
            )}

            {/* Keyframe properties */}
            <PropertyEditor
              obj={kf}
              isKeyframe={true}
              onChange={() => onAnimationChange({ ...animation })}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
