/**
 * Character introspection helpers.
 *
 * Derives display + editing metadata from the character's bone rig:
 *  - which flat hurtbubble indices carry a named-bubble alias
 *    (`headbubble`, `corebubble`, …)
 *  - a human label for each bubble index (bone endpoints + aliases)
 *  - the 3D model name(s) attached to each bone via its prefab
 *  - left/right bone pairings used by the mirror tool
 *
 * Keep this pure (no React / DOM) so it can be unit-tested directly.
 */

import type { EntityData, HurtbubbleData } from '../types';

/** Map a flat bubble index to the character's named-bubble aliases.
 *  `character.headbubble = 3` → index 3 is labelled "head". */
export const namedBubbleAliases = (character: EntityData): Map<number, string[]> => {
  const out = new Map<number, string[]>();
  for (const k of Object.getOwnPropertyNames(character)) {
    if (!k.endsWith('bubble')) continue;
    const v = (character as Record<string, unknown>)[k];
    if (typeof v !== 'number') continue;
    // Strip the trailing "bubble" for a tidier label ("headbubble" → "head").
    const label = k.endsWith('bubble') && k.length > 6 ? k.slice(0, -6) : k;
    const list = out.get(v) ?? [];
    list.push(label);
    out.set(v, list);
  }
  return out;
};

/** Human-readable label for a flat bubble index: named-bubble aliases take
 *  priority, otherwise the owning bone's name (with `2` suffix for the i2
 *  endpoint). Returns `null` when the index isn't referenced by any bone. */
export const bubbleLabels = (character: EntityData): Map<number, string> => {
  const aliases = namedBubbleAliases(character);
  const out = new Map<number, string>();
  character.hurtbubbles.forEach((bone) => {
    if (!out.has(bone.i1)) out.set(bone.i1, bone.name);
    if (bone.i2 !== bone.i1 && !out.has(bone.i2)) out.set(bone.i2, `${bone.name}2`);
  });
  // Aliases win over derived bone names.
  for (const [idx, names] of aliases) {
    out.set(idx, names.join('/'));
  }
  return out;
};

/** Swap a left/right side token at the start of a bone or follow name.
 *  Handles `r`/`l` single-letter prefixes (rfoot→lfoot) and `right`/`left`
 *  words. Returns the input unchanged when no side token is present. */
export const mirrorName = (name: string): string => {
  if (/^right/i.test(name)) return name.replace(/^right/i, (m) => (m[0] === 'R' ? 'Left' : 'left'));
  if (/^left/i.test(name)) return name.replace(/^left/i, (m) => (m[0] === 'L' ? 'Right' : 'right'));
  // Single-letter side prefix immediately followed by a word char (rfoot, lLeg).
  if (/^r[a-zA-Z]/.test(name)) return 'l' + name.slice(1);
  if (/^l[a-zA-Z]/.test(name)) return 'r' + name.slice(1);
  return name;
};

/** Build the flat-index permutation that swaps left/right bubbles when an
 *  animation is mirrored. `perm[a]` is the bubble index whose (negated-x)
 *  data should land at index `a`. Centre/unpaired bubbles map to themselves. */
export const mirrorBubblePermutation = (character: EntityData): number[] => {
  const bones = character.hurtbubbles;
  const byName = new Map<string, HurtbubbleData>();
  for (const b of bones) byName.set(b.name, b);

  let max = -1;
  for (const b of bones) max = Math.max(max, b.i1, b.i2);
  const perm = Array.from({ length: max + 1 }, (_, i) => i);

  for (const b of bones) {
    const partner = byName.get(mirrorName(b.name));
    if (!partner || partner === b) continue;
    perm[b.i1] = partner.i1;
    perm[b.i2] = partner.i2;
  }
  return perm;
};

/** Model name(s) attached to a bone via its prefab, joined for display. */
export const boneModelLabel = (bone: HurtbubbleData): string | null => {
  const models = bone.prefab?.models;
  if (!Array.isArray(models) || models.length === 0) return null;
  const names = models.map((m) => m?.name).filter((n): n is string => !!n);
  return names.length ? names.join(', ') : null;
};
