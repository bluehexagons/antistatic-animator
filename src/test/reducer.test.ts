import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from '../animator/context/AnimatorContext';
import type { Animation } from '../animator/types';
import { createStageDocument } from '../stage/document';

const anim = (): Animation => ({ keyframes: [{ duration: 1 }, { duration: 2 }, { duration: 3 }] });

describe('appReducer SET_ANIMATION', () => {
  it('fresh selection sets name and resets keyframe/selection', () => {
    const a = anim();
    const next = appReducer(
      { ...initialState, keyframe: 2, selectedBubble: 4 },
      { type: 'SET_ANIMATION', payload: { animation: a, name: 'jab' } }
    );
    expect(next.animation).toBe(a);
    expect(next.animationName).toBe('jab');
    expect(next.keyframe).toBe(0);
    expect(next.selectedBubble).toBe(-1);
  });

  it('in-place edit (no name) preserves keyframe + selection', () => {
    const start = {
      ...initialState,
      animation: anim(),
      animationName: 'jab',
      keyframe: 2,
      selectedBubble: 4,
    };
    const edited = { ...start.animation } as Animation;
    const next = appReducer(start, { type: 'SET_ANIMATION', payload: { animation: edited } });
    expect(next.animation).toBe(edited);
    expect(next.animationName).toBe('jab'); // name retained
    expect(next.keyframe).toBe(2); // playhead held
    expect(next.selectedBubble).toBe(4); // selection held
  });

  it('clearing the animation resets everything', () => {
    const start = {
      ...initialState,
      animation: anim(),
      animationName: 'jab',
      keyframe: 2,
      selectedBubble: 4,
    };
    const next = appReducer(start, { type: 'SET_ANIMATION', payload: { animation: null } });
    expect(next.animation).toBeNull();
    expect(next.animationName).toBe('');
    expect(next.keyframe).toBe(0);
    expect(next.selectedBubble).toBe(-1);
  });

  it('in-place edit with updateParsed replaces the parsed map entry', () => {
    const parsed = { jab: anim(), utilt: anim() };
    const start = { ...initialState, parsed, animation: parsed.jab, animationName: 'jab' };
    const edited = { ...parsed.jab, iasa: 10 } as Animation;
    const next = appReducer(start, {
      type: 'SET_ANIMATION',
      payload: { animation: edited, updateParsed: true },
    });
    expect(next.animation).toBe(edited);
    expect(next.parsed?.jab).toBe(edited);
    expect(next.parsed?.utilt).toBe(parsed.utilt); // other entries unchanged
  });

  it('REPLACE_STATE restores a full state snapshot', () => {
    const restored = { ...initialState, animationName: 'restored' };
    const next = appReducer(initialState, { type: 'REPLACE_STATE', payload: restored });
    expect(next).toBe(restored);
  });
});

describe('appReducer stage document state', () => {
  it('sets the stage document, file, and scene selection', () => {
    const stage = createStageDocument('Fixture');
    let next = appReducer(initialState, { type: 'SET_STAGE_FILE', payload: 'stages/fixture.json' });
    next = appReducer(next, { type: 'SET_STAGE', payload: stage });
    next = appReducer(next, {
      type: 'SET_STAGE_SELECTION',
      payload: { kind: 'collision', id: 'main-platform' },
    });

    expect(next.stage).toBe(stage);
    expect(next.stageFile).toBe('stages/fixture.json');
    expect(next.stageSelection).toEqual({ kind: 'collision', id: 'main-platform' });
  });
});
