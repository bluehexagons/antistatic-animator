/**
 * File operations
 * Functions for saving and loading animation files
 */

import path from '../../runtime/path';
import fs from '../../runtime/fs';
import { characterDir } from '../../utils';
import type { AnimationMap } from '../types';

/**
 * Populate a select element with options
 * @param select The select element to populate
 * @param options Array of option strings
 */
export const populateSelect = (select: HTMLSelectElement, options: string[]) => {
  while (select.options.length > 0) {
    select.options.remove(0);
  }
  for (let i = 0; i < options.length; i++) {
    const option = document.createElement('option');
    option.text = options[i];
    select.add(option);
  }
};

/**
 * Save current animation data to file
 * Formats hurtbubbles arrays on single lines for readability
 *
 * @param animFile Animation file name
 * @param parsed Animation data to save
 */
export const save = (animFile: string, parsed: AnimationMap) => {
  if (animFile === '') {
    return;
  }

  const s =
    JSON.stringify(parsed, null, '  ').replace(
      /("hurtbubbles": \[\n)([^\]]*)(\n\s*\])/gm,
      (_, ...b) => {
        const s = b[1].replace(
          /(\s+[\d.-]+),\n\s+([\d.-]+),\n\s+([\d.-]+),\n\s+([\d.-]+,?)/g,
          '$1, $2, $3, $4'
        );
        return b[0] + s + b[2];
      }
    ) + '\n';

  fs.writeFileSync(path.resolve(characterDir, animFile), s, {
    encoding: 'utf8',
  });
};
