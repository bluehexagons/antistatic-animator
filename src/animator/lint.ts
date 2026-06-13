/**
 * Lightweight validation for animation data. Catches the mistakes the
 * engine would silently downgrade or refuse (unknown handler names,
 * dangling follow refs, mismatched hurtbubble counts, unknown easing
 * functions, hitbubble continuation with no predecessor).
 *
 * Not a substitute for actually loading the file in the game — the
 * engine validates more thoroughly. This is meant to surface issues
 * during authoring while the user is in the editor.
 */

import { Ease } from '../easing';
import { objHas } from '../utils';
import {
  AnimationTypeNames,
  HandlerEvents,
  HitbubbleTypes,
  HurtbubbleStateById,
  KnownHandlerNames,
  TweenNames,
} from './schema';
import type { Animation, EntityData, Hitbubble, Keyframe } from './types';
import { modelTransformUnknownKeys } from './operations/model-transform-timeline';

export interface LintIssue {
  severity: 'error' | 'warn' | 'info';
  message: string;
  /** Optional keyframe index this issue points at, or `-1` for animation-level. */
  keyframe: number;
}

const knownTweens = new Set([...TweenNames, ...Object.getOwnPropertyNames(Ease)]);
const knownTypes = new Set<string>(AnimationTypeNames);

/** Resolve the set of bubble names a hitbubble's `follow` can reference. */
const followCandidates = (character: EntityData): Set<string> => {
  const out = new Set<string>();
  for (const b of character.hurtbubbles) {
    if (b?.name) {
      out.add(b.name);
      out.add(`${b.name}2`);
    }
  }
  for (const k of Object.getOwnPropertyNames(character)) {
    if (k.endsWith('bubble') && typeof (character as Record<string, unknown>)[k] === 'number') {
      out.add(k);
    }
  }
  return out;
};

const expectedHurtbubbleCount = (character: EntityData): number => {
  // Each bone has i1/i2 pointing into the flat array; the array's length
  // should cover the highest referenced index.
  let max = -1;
  for (const b of character.hurtbubbles) {
    if (b.i1 > max) max = b.i1;
    if (b.i2 > max) max = b.i2;
  }
  return (max + 1) * 4;
};

export function lintAnimation(
  character: EntityData,
  animation: Animation,
  name?: string
): LintIssue[] {
  const issues: LintIssue[] = [];
  const expectedHb = expectedHurtbubbleCount(character);
  const validFollows = followCandidates(character);

  // Animation-level checks
  if (animation.type !== undefined && !knownTypes.has(String(animation.type))) {
    issues.push({
      severity: 'warn',
      keyframe: -1,
      message: `Unknown animation type: "${animation.type}" — expected one of ${AnimationTypeNames.join(', ')}.`,
    });
  }
  for (const ev of HandlerEvents) {
    const v = (animation as Record<string, unknown>)[ev];
    if (typeof v !== 'string' || !v) continue;
    const known = KnownHandlerNames[ev];
    if (known.length > 0 && !known.includes(v)) {
      issues.push({
        severity: 'info',
        keyframe: -1,
        message: `Animation handler "${ev}: ${v}" not in the known-name list — may still be valid.`,
      });
    }
  }

  // Per-keyframe checks
  if (animation.keyframes.length === 0) {
    issues.push({
      severity: 'error',
      keyframe: -1,
      message: 'Animation has no keyframes.',
    });
  }
  for (let i = 0; i < animation.keyframes.length; i++) {
    const kf: Keyframe = animation.keyframes[i];

    // hurtbubble count check
    if (Array.isArray(kf.hurtbubbles)) {
      if (kf.hurtbubbles.length !== expectedHb) {
        issues.push({
          severity: 'error',
          keyframe: i,
          message: `Hurtbubble array has ${kf.hurtbubbles.length} numbers; character expects ${expectedHb} (${expectedHb / 4} bubbles × 4 fields).`,
        });
      }
      // unknown state values
      for (let j = 3; j < kf.hurtbubbles.length; j += 4) {
        const s = kf.hurtbubbles[j];
        if (typeof s === 'number' && !HurtbubbleStateById.has(s as 0)) {
          issues.push({
            severity: 'warn',
            keyframe: i,
            message: `Bubble ${(j - 3) / 4} has unknown state id ${s}.`,
          });
        }
      }
    }

    // hitbubble continuation requires a real previous one
    if (kf.hitbubbles === true) {
      if (i === 0) {
        issues.push({
          severity: 'error',
          keyframe: i,
          message: '`hitbubbles: true` on the first keyframe has nothing to continue from.',
        });
      } else {
        // Walk back through continuations to find an array.
        let j = i - 1;
        while (j >= 0 && animation.keyframes[j].hitbubbles === true) j--;
        if (j < 0 || !Array.isArray(animation.keyframes[j]?.hitbubbles)) {
          issues.push({
            severity: 'error',
            keyframe: i,
            message: '`hitbubbles: true` chain has no array predecessor.',
          });
        }
      }
    } else if (Array.isArray(kf.hitbubbles)) {
      for (let h = 0; h < kf.hitbubbles.length; h++) {
        const hb: Hitbubble = kf.hitbubbles[h];
        if (hb.type && !HitbubbleTypes.includes(hb.type as never)) {
          issues.push({
            severity: 'warn',
            keyframe: i,
            message: `Hitbox #${h} type "${hb.type}" not recognised.`,
          });
        }
        if (typeof hb.follow === 'string' && hb.follow && !validFollows.has(hb.follow)) {
          issues.push({
            severity: 'warn',
            keyframe: i,
            message: `Hitbox #${h} follow target "${hb.follow}" not found on character.`,
          });
        }
        const smear = hb.smear as { follow?: string } | undefined;
        if (
          smear &&
          typeof smear.follow === 'string' &&
          smear.follow &&
          !validFollows.has(smear.follow)
        ) {
          issues.push({
            severity: 'warn',
            keyframe: i,
            message: `Hitbox #${h} smear.follow "${smear.follow}" not found on character.`,
          });
        }
        if (typeof hb.radius === 'number' && hb.radius <= 0) {
          issues.push({
            severity: 'warn',
            keyframe: i,
            message: `Hitbox #${h} has non-positive radius (${hb.radius}).`,
          });
        }
      }
    }

    if (objHas(kf, 'hurtbubbleModelTransforms')) {
      const data = kf.hurtbubbleModelTransforms;
      if (data === true) {
        let j = i - 1;
        while (j >= 0 && animation.keyframes[j]?.hurtbubbleModelTransforms === true) j--;
        if (
          j < 0 ||
          !animation.keyframes[j] ||
          !objHas(animation.keyframes[j], 'hurtbubbleModelTransforms')
        ) {
          issues.push({
            severity: 'error',
            keyframe: i,
            message: '`hurtbubbleModelTransforms: true` chain has no anchor predecessor.',
          });
        }
      } else if (Array.isArray(data)) {
        const flatNumeric = data.every((value) => typeof value === 'number');
        if (flatNumeric && data.length !== character.hurtbubbles.length * 3) {
          issues.push({
            severity: 'warn',
            keyframe: i,
            message: `Flat hurtbubbleModelTransforms has ${data.length} numbers; character expects ${character.hurtbubbles.length * 3} (${character.hurtbubbles.length} bones × 3 fields).`,
          });
        } else if (!flatNumeric && data.length > character.hurtbubbles.length) {
          issues.push({
            severity: 'warn',
            keyframe: i,
            message: `Per-bone hurtbubbleModelTransforms has ${data.length} entries; character only has ${character.hurtbubbles.length} bones.`,
          });
        }
      } else {
        const unknown = modelTransformUnknownKeys(character, data);
        for (const key of unknown) {
          issues.push({
            severity: 'warn',
            keyframe: i,
            message: `Model transform target "${key}" not found on character.`,
          });
        }
      }
    }

    // tween must be known
    const tween = (kf as Record<string, unknown>).tween;
    if (typeof tween === 'string' && tween && !knownTweens.has(tween)) {
      issues.push({
        severity: 'warn',
        keyframe: i,
        message: `Unknown tween "${tween}" — not in the easing table.`,
      });
    }

    // per-keyframe handler-name suggestions
    for (const ev of HandlerEvents) {
      const v = (kf as Record<string, unknown>)[ev];
      if (typeof v !== 'string' || !v) continue;
      const known = KnownHandlerNames[ev];
      if (known.length > 0 && !known.includes(v)) {
        issues.push({
          severity: 'info',
          keyframe: i,
          message: `Keyframe handler "${ev}: ${v}" not in the known-name list — may still be valid.`,
        });
      }
    }

    // duration sanity
    if (typeof kf.duration !== 'number' || kf.duration <= 0) {
      issues.push({
        severity: 'warn',
        keyframe: i,
        message: `Keyframe duration ${JSON.stringify(kf.duration)} is non-positive or missing.`,
      });
    }
  }

  // Reference to `name` exists in messages above only conceptually; including it
  // here keeps lint outputs identifiable in batched lint runs.
  if (name && issues.length > 0 && objHas(animation, 'name')) {
    // no-op: name kept for the caller's grouping convenience
  }

  return issues;
}
