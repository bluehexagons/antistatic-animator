import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from '../animator/context/AnimatorContext';
import type { Animation } from '../animator/types';

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
});
