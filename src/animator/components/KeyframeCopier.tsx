/**
 * KeyframeCopier Component
 *
 * Buttons for manipulating keyframes (copy, swap, clone, remove).
 * Replaces the keyframeCopier function from ui-builders.ts.
 */

import React, { useCallback } from 'react';
import type { Animation } from '../types';

interface KeyframeCopierProps {
  animation: Animation;
  keyframeIndex: number;
  onAnimationChange: (animation: Animation) => void;
}

export const KeyframeCopier: React.FC<KeyframeCopierProps> = ({
  animation,
  keyframeIndex,
  onAnimationChange,
}) => {
  const keyframes = animation.keyframes;
  const isFirst = keyframeIndex === 0;
  const isLast = keyframeIndex === keyframes.length - 1;

  const copyKeyframe = useCallback(
    (sourceIdx: number, destIdx: number) => {
      if (sourceIdx < 0 || sourceIdx >= keyframes.length) return;
      if (destIdx < 0 || destIdx >= keyframes.length) return;

      const source = keyframes[sourceIdx];
      // Deep copy the keyframe
      keyframes[destIdx] = JSON.parse(JSON.stringify(source));
      onAnimationChange({ ...animation });
    },
    [keyframes, animation, onAnimationChange]
  );

  const swapKeyframe = useCallback(
    (dir: 'left' | 'right') => {
      const targetIdx = dir === 'left' ? keyframeIndex - 1 : keyframeIndex + 1;
      if (targetIdx < 0 || targetIdx >= keyframes.length) return;

      const temp = keyframes[keyframeIndex];
      keyframes[keyframeIndex] = keyframes[targetIdx];
      keyframes[targetIdx] = temp;
      onAnimationChange({ ...animation });
    },
    [keyframes, keyframeIndex, animation, onAnimationChange]
  );

  const cloneKeyframe = useCallback(
    (dir: 'left' | 'right') => {
      const insertIdx = dir === 'left' ? keyframeIndex : keyframeIndex + 1;
      const source = JSON.parse(JSON.stringify(keyframes[keyframeIndex]));
      keyframes.splice(insertIdx, 0, source);
      onAnimationChange({ ...animation });
    },
    [keyframes, keyframeIndex, animation, onAnimationChange]
  );

  const removeKeyframe = useCallback(() => {
    if (keyframes.length <= 1) return;
    keyframes.splice(keyframeIndex, 1);
    onAnimationChange({ ...animation });
  }, [keyframes, keyframeIndex, animation, onAnimationChange]);

  return (
    <div className="keyframe-copier">
      <button
        onClick={() => swapKeyframe('left')}
        disabled={isFirst}
        title="Swap with previous keyframe"
      >
        ⇐
      </button>
      <button
        onClick={() => swapKeyframe('right')}
        disabled={isLast}
        title="Swap with next keyframe"
      >
        ⇒
      </button>
      <button onClick={() => cloneKeyframe('left')} title="Clone to the left">
        ⬅
      </button>
      <button onClick={() => cloneKeyframe('right')} title="Clone to the right">
        ➡
      </button>
      <button
        onClick={removeKeyframe}
        disabled={keyframes.length <= 1}
        title="Remove this keyframe"
      >
        ✕
      </button>
      <button onClick={() => copyKeyframe(keyframeIndex, keyframeIndex)} title="Copy from editor">
        ↓
      </button>
    </div>
  );
};
