/**
 * StatsDisplay component
 * Shows animation frame data statistics (duration, windup, hits, backswing)
 */

import React from 'react';
import type { Animation } from '../types';
import { objHas } from '../../utils';

interface StatsDisplayProps {
  animation: Animation;
}

/**
 * Calculate animation statistics
 */
const calculateStats = (animation: Animation) => {
  let windup = 0;
  let frame = 0;
  const hitboxTimings: string[] = [];
  let backswing = 0;
  let kfn = 0;
  const kfs = animation.keyframes;

  // Calculate windup (frames before first hit)
  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn];
    if (objHas(kf, 'hitbubbles')) {
      break;
    }
    frame += kf.duration;
    windup += kf.duration;
  }

  // Find all hitbox timings
  let lastHB = kfn;
  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn];
    frame += kf.duration;
    if (!objHas(kf, 'hitbubbles')) {
      continue;
    }
    lastHB = kfn;
    hitboxTimings.push(`${frame - kf.duration + 1}-${frame}`);
  }

  // Calculate backswing (frames after last hit)
  kfn = lastHB + 1;
  for (; kfn < kfs.length - 1; kfn++) {
    const kf = kfs[kfn];
    backswing += kf.duration;
  }

  // Calculate total duration
  frame = 0;
  for (let i = 0; i < kfs.length - 1; i++) {
    frame += kfs[i].duration;
  }

  // Account for IASA (Interruptible As Soon As)
  if (objHas(animation, 'iasa')) {
    backswing -= animation['iasa'];
    frame -= animation['iasa'];
  }

  return {
    duration: frame,
    windup,
    hits: hitboxTimings.join(', '),
    backswing,
  };
};

export const StatsDisplay: React.FC<StatsDisplayProps> = ({ animation }) => {
  const stats = calculateStats(animation);

  return (
    <div>
      <div>Duration: {stats.duration}</div>
      <div>Windup: {stats.windup}</div>
      <div>Hits: {stats.hits}</div>
      <div>Backswing: {stats.backswing}</div>
    </div>
  );
};
