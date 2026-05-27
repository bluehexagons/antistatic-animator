/**
 * File operations
 * Save animation data to disk via the active storage backend.
 *
 * Strategy: do as little textual change as possible so that JSONC
 * comments and incidental formatting in the on-disk file survive a
 * round-trip. We re-parse the file as it sits on disk, compare each
 * top-level animation key against what's in memory, and use
 * `jsonc-parser.modify()` to surgically replace only the animations
 * that actually changed (or to add/remove entries). Everything
 * outside the touched ranges, including comments, is preserved
 * verbatim.
 */

import * as JSONC from 'jsonc-parser';
import { library } from '../../storage/library';
import type { AnimationMap } from '../types';

const FORMAT_OPTS: JSONC.FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
  eol: '\n',
};

/** Pretty-format hurtbubble arrays on one line per (x,y,r,state) row. */
const reformatHurtbubbleArrays = (text: string): string =>
  text.replace(/("hurtbubbles":\s*\[\n)([^\]]*)(\n\s*\])/gm, (_match, head, body, tail) => {
    const compact = (body as string).replace(
      /(\s+-?[\d.]+),\n\s+(-?[\d.]+),\n\s+(-?[\d.]+),\n\s+(-?[\d.]+,?)/g,
      '$1, $2, $3, $4'
    );
    return head + compact + tail;
  });

/** Stable, comparable shape for an animation entry. */
const canonicalize = (v: unknown): string => JSON.stringify(v);

const parseAnimationMap = (text: string): AnimationMap | null => {
  try {
    const original = JSONC.parse(text) as AnimationMap;
    if (!original || typeof original !== 'object' || Array.isArray(original)) return null;
    return original;
  } catch {
    return null;
  }
};

const renderCleanAnimationFile = (parsed: AnimationMap): string => {
  const out = JSON.stringify(parsed, null, '  ');
  return reformatHurtbubbleArrays(out) + '\n';
};

/**
 * Compute a minimal set of jsonc-parser modify ops that bring
 * `originalText` (parsed structure) into agreement with `current`.
 *
 * Only diffs at the top-level animation-name granularity. That keeps
 * comments outside changed animations intact and is enough fidelity
 * for the shipped game data.
 */
export const buildJsoncEdits = (originalText: string, current: AnimationMap): JSONC.Edit[] => {
  const edits: JSONC.Edit[] = [];
  const original = parseAnimationMap(originalText);
  if (!original) return [];

  const seen = new Set<string>();
  for (const key of Object.getOwnPropertyNames(current)) {
    seen.add(key);
    const before = (original as Record<string, unknown>)[key];
    const after = (current as Record<string, unknown>)[key];
    if (canonicalize(before) !== canonicalize(after)) {
      edits.push(...JSONC.modify(originalText, [key], after, { formattingOptions: FORMAT_OPTS }));
    }
  }
  for (const key of Object.getOwnPropertyNames(original)) {
    if (seen.has(key)) continue;
    // Removed: write `undefined` so the key is dropped.
    edits.push(...JSONC.modify(originalText, [key], undefined, { formattingOptions: FORMAT_OPTS }));
  }
  return edits;
};

/**
 * Render the new file contents for an animation map, preserving JSONC
 * comments from the original file where possible.
 */
export const renderAnimationFile = (
  originalText: string | undefined,
  parsed: AnimationMap
): string => {
  if (originalText) {
    if (!parseAnimationMap(originalText)) {
      return renderCleanAnimationFile(parsed);
    }
    const edits = buildJsoncEdits(originalText, parsed);
    if (edits.length === 0) {
      return originalText.endsWith('\n') ? originalText : `${originalText}\n`;
    }
    let text = JSONC.applyEdits(originalText, edits);
    text = reformatHurtbubbleArrays(text);
    return text.endsWith('\n') ? text : `${text}\n`;
  }
  // No original text — fall back to a clean stringify.
  return renderCleanAnimationFile(parsed);
};

/**
 * Save current animation data via the active storage backend, preserving
 * JSONC comments from the on-disk file whenever possible.
 */
export const save = async (animFile: string, parsed: AnimationMap): Promise<void> => {
  if (!animFile) return;
  const original = library.get(animFile);
  const text = renderAnimationFile(original, parsed);
  await library.save(animFile, text);
};
