/**
 * Render smoke tests — mount each major editor component with realistic mock
 * data and assert it renders without throwing. Catches render-time crashes
 * (undefined access, bad casts) that type-checking and pure-logic tests miss.
 *
 * Effects don't run under renderToStaticMarkup, but the bulk of each
 * component's logic executes during render.
 */

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import type { Animation, EntityData } from '../animator/types';
import { StageViewer } from '../app/StageViewer';
import { Inspector } from '../app/Inspector';
import { Timeline } from '../app/Timeline';

const character: EntityData = {
  name: 'carbon',
  headbubble: 3,
  corebubble: 2,
  shieldX: 10,
  shieldY: 30,
  shieldX2: 10,
  shieldY2: 20,
  shieldMinSize: 8,
  shieldGrowth: 19,
  hurtbubbles: [
    {
      name: 'rfoot',
      i1: 1,
      i2: 0,
      z: 4,
      prefab: { models: [{ name: 'CarbonFootGem' }, { name: 'CarbonFootMid' }] },
    },
    { name: 'rleg', i1: 0, i2: 2, z: 4 },
    { name: 'body', i1: 2, i2: 2, z: 0 },
    { name: 'head', i1: 3, i2: 3, z: 0 },
    { name: 'lleg', i1: 4, i2: 2, z: -4 },
    { name: 'lfoot', i1: 5, i2: 4, z: -4 },
  ],
};

const pose = [-1, 18, 4, 1, 15, 5, 5, 1, 1, 35, 9, 3, 5, 52, 10, 1, -9, 22, 4, 1, 0, 5, 5, 1];

const animation: Animation = {
  type: 'attack',
  iasa: 20,
  redirect: { grab: 'dashgrab' },
  keyframes: [
    {
      duration: 3,
      hurtbubbles: pose.slice(),
      interpolate: true,
      tween: 'sineInOut',
      hitbubbles: [
        {
          type: 'ground',
          x: 5,
          y: 10,
          radius: 8,
          follow: 'head',
          flags: ['meteor'],
          audio: { name: 'hit', pitch: 0.6 },
          smear: { x: 1, y: 2, follow: 'rleg' },
          damage: 5,
          knockback: 6,
          angle: 45,
          sakurai: true,
        },
      ],
    },
    { duration: 2, hurtbubbles: pose.slice(), hitbubbles: true },
    { duration: 4, hurtbubbles: pose.slice(), spawn: { name: 'laser', x: 0, y: 20 } },
  ],
};

const noop = () => {};

describe('render smoke', () => {
  it('StageViewer renders with every overlay enabled', () => {
    const html = renderToStaticMarkup(
      <StageViewer
        character={character}
        animation={animation}
        keyframe={0}
        tick={1}
        camera={{ x: 0, y: 0.1, scale: 2 }}
        selectedBubble={2}
        onSelectBubble={noop}
        selectedHitbubble={0}
        onSelectHitbubble={noop}
        onCameraChange={noop}
        onBubbleChange={noop}
        showGrid
        showGround
        showHitboxes
        showOnion
        showLabels
        showShield
      />
    );
    expect(html).toContain('<svg');
    expect(html).toContain('shield');
  });

  it('Inspector renders all sections', () => {
    const html = renderToStaticMarkup(
      <Inspector
        character={character}
        animation={animation}
        keyframe={0}
        selectedBubble={2}
        onSelectBubble={noop}
        selectedHitbubble={0}
        onSelectHitbubble={noop}
        onAnimationChange={noop}
      />
    );
    expect(html).toContain('Hurtbubbles');
    expect(html).toContain('Hitbubbles');
  });

  it('Timeline renders the keyframe strip', () => {
    const html = renderToStaticMarkup(
      <Timeline
        character={character}
        animation={animation}
        keyframe={1}
        onKeyframeSelect={noop}
        onAnimationChange={noop}
        playing={false}
        onPlayingChange={noop}
        tick={0}
        onTickChange={noop}
        loopMode="loop"
        onLoopModeChange={noop}
      />
    );
    expect(html).toContain('Mirror');
    expect(html).toContain('Paste');
  });

  it('Inspector renders a continuation (hitbubbles:true) keyframe', () => {
    const html = renderToStaticMarkup(
      <Inspector
        character={character}
        animation={animation}
        keyframe={1}
        selectedBubble={-1}
        onSelectBubble={noop}
        selectedHitbubble={-1}
        onSelectHitbubble={noop}
        onAnimationChange={noop}
      />
    );
    expect(html).toContain('Inheriting');
  });
});
