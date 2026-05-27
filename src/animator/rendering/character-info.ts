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

/** Model name(s) attached to a bone via its prefab, joined for display. */
export const boneModelLabel = (bone: HurtbubbleData): string | null => {
  const models = bone.prefab?.models;
  if (!Array.isArray(models) || models.length === 0) return null;
  const names = models.map((m) => m?.name).filter((n): n is string => !!n);
  return names.length ? names.join(', ') : null;
};
