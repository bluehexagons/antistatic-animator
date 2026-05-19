/**
 * File operations
 * Functions for saving animation files via the active storage backend.
 */

import { library } from '../../storage/library';
import type { AnimationMap } from '../types';

/**
 * Format animation map as JSON with single-line hurtbubble arrays.
 */
export const formatAnimationJson = (parsed: AnimationMap): string => {
  return (
    JSON.stringify(parsed, null, '  ').replace(
      /("hurtbubbles": \[\n)([^\]]*)(\n\s*\])/gm,
      (_, ...b) => {
        const inner = b[1].replace(
          /(\s+[\d.-]+),\n\s+([\d.-]+),\n\s+([\d.-]+),\n\s+([\d.-]+,?)/g,
          '$1, $2, $3, $4'
        );
        return b[0] + inner + b[2];
      }
    ) + '\n'
  );
};

/**
 * Save current animation data to file via the active backend.
 */
export const save = async (animFile: string, parsed: AnimationMap): Promise<void> => {
  if (!animFile) return;
  const text = formatAnimationJson(parsed);
  await library.save(animFile, text);
};
