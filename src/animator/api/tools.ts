/**
 * Tools API
 * Console utilities for batch operations on animations
 * Exposed as window.Tools for power users
 */

import type { Keyframe, AnimationMap, Animation } from '../types';
import { save } from '../operations/file-operations';

/**
 * Create the Tools API object with references to state
 */
export const createTools = (
  getParsed: () => AnimationMap | null,
  getLoadedAnimation: () => Animation | null,
  getAnimFile: () => string
) => {
  const Tools = {
    /**
     * Iterate all keyframes across all animations
     */
    *iterateKeyframes(): Generator<Keyframe, void, void> {
      const parsed = getParsed();
      if (!parsed) return;
      for (const a of Object.getOwnPropertyNames(parsed)) {
        for (const kf of parsed[a].keyframes) {
          yield kf;
        }
      }
    },

    /**
     * Iterate keyframes of currently loaded animation only
     */
    *iterateCurrentKeyframes(): Generator<Keyframe, void, void> {
      const loadedAnimation = getLoadedAnimation();
      if (!loadedAnimation) return;
      for (const kf of loadedAnimation.keyframes) {
        yield kf;
      }
    },

    /**
     * Iterate all animations
     */
    *iterateAnimations(): Generator<Animation, void, void> {
      const parsed = getParsed();
      if (!parsed) return;
      for (const a of Object.getOwnPropertyNames(parsed)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy: dynamic property access
        yield parsed[a] as any;
      }
    },

    /**
     * Insert a new bubble at the specified index across all keyframes
     * Yields [keyframe, slice] for each keyframe, allowing customization before insertion
     *
     * @param index Bubble index to insert at (-1 = end)
     */
    *insertBubble(index = -1): Generator<[Keyframe, number[]], void, void> {
      const j = index * 4;
      if (index < 0) {
        return;
      }
      for (const kf of Tools.iterateKeyframes()) {
        if (!kf.hurtbubbles || !Array.isArray(kf.hurtbubbles)) {
          continue;
        }
        const slice = [0, 0, 0, 0];
        yield [kf, slice];
        kf.hurtbubbles.splice(j, 0, ...slice);
      }
    },

    /**
     * Delete a bubble at the specified index across all keyframes
     *
     * @param index Bubble index to delete (-1 = end)
     */
    deleteBubble(index = -1): void {
      const j = index * 4;
      if (index < 0) {
        return;
      }
      for (const kf of Tools.iterateKeyframes()) {
        if (!kf.hurtbubbles || !Array.isArray(kf.hurtbubbles)) {
          continue;
        }
        kf.hurtbubbles.splice(j, 4);
      }
    },

    /**
     * Save current animation to file
     */
    save(): void {
      const animFile = getAnimFile();
      const parsed = getParsed();
      if (parsed) {
        save(animFile, parsed);
      }
    },
  };

  return Tools;
};
