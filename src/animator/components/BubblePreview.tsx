/**
 * BubblePreview Component
 *
 * Small SVG thumbnail preview of a keyframe.
 * Replaces the bubblePreview function from ui-builders.ts.
 */

import React from 'react';
import { BubbleViewer } from './BubbleViewer';
import type { EntityData, Animation, CameraState } from '../types';

interface BubblePreviewProps {
  character: EntityData;
  animation: Animation;
  keyframeIndex: number;
  camera: CameraState;
  onSelect: () => void;
}

export const BubblePreview: React.FC<BubblePreviewProps> = ({
  character,
  animation,
  keyframeIndex,
  onSelect,
}) => {
  // Thumbnail uses fixed 70x50 size at scale=1
  const thumbnailCamera = {
    x: 0,
    y: 0.1,
    scale: 1,
  };

  return (
    <div className="bubble-preview" onClick={onSelect} style={{ cursor: 'pointer' }}>
      <BubbleViewer
        character={character}
        animation={animation}
        keyframe={keyframeIndex}
        camera={thumbnailCamera}
        width={70}
        height={50}
      />
    </div>
  );
};
