/**
 * Small shared utilities. Storage and watching has moved to `./storage/`.
 */

export const objHas = (o: object, prop: string | number | symbol) =>
  Object.prototype.hasOwnProperty.call(o, prop);

/** File extension pattern for JSONC character/animation data files. */
export const DATA_FILE_RE = /\.jsonc?$/i;

/** Bone names and named-bubble aliases a hitbubble `follow` can target. */
export const followCandidates = (character: {
  hurtbubbles: { name?: string }[];
  [name: string]: unknown;
}): Set<string> => {
  const out = new Set<string>();
  for (const b of character.hurtbubbles) {
    if (b?.name) {
      out.add(b.name);
      out.add(`${b.name}2`);
    }
  }
  for (const k of Object.getOwnPropertyNames(character)) {
    if (k.endsWith('bubble') && typeof character[k] === 'number') {
      out.add(k);
    }
  }
  return out;
};
