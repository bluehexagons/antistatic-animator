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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '8px',
        marginBottom: '15px',
        padding: '10px',
        backgroundColor: '#2a2a2a',
        borderRadius: '3px',
        border: '1px solid #333',
      }}
    >
      <div style={{ fontSize: '8pt', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#4a9eff', marginRight: '4px', fontWeight: 'bold' }}>⏱</span>
        <span>Duration:</span>
        <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>{stats.duration}</span>
      </div>
      <div style={{ fontSize: '8pt', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#4a9eff', marginRight: '4px', fontWeight: 'bold' }}>▶</span>
        <span>Windup:</span>
        <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>{stats.windup}</span>
      </div>
      <div style={{ fontSize: '8pt', display: 'flex', alignItems: 'center', gridColumn: '1 / -1' }}>
        <span style={{ color: '#4a9eff', marginRight: '4px', fontWeight: 'bold' }}>⚔</span>
        <span>Hits:</span>
        <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>{stats.hits || '—'}</span>
      </div>
      <div style={{ fontSize: '8pt', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#4a9eff', marginRight: '4px', fontWeight: 'bold' }}>◀</span>
        <span>Backswing:</span>
        <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>{stats.backswing}</span>
      </div>
    </div>
  );
};
