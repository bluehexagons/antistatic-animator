/**
 * Constants and configuration for the animator
 */

import { Ease } from '../easing';
import { AnimationTypeNames, HandlerEvents, KnownHandlerNames, TweenNames } from './schema';
import type { Multichoices } from './types';

/** Multichoice dropdown configurations.
 *  Tween + animation type are tight enough to require a dropdown; everything
 *  else (handler-name suggestions, etc.) goes through `valueSuggestions`. */
export const multichoice: { [s: string]: Multichoices } = {
  tween: {
    default: 'linear',
    choices: [...new Set([...TweenNames, ...Object.getOwnPropertyNames(Ease)])].sort(),
  },
  type: {
    default: 'movement',
    choices: [...AnimationTypeNames],
  },
};

/** Free-text fields that get a `<datalist>` of known good values.
 *  Suggestions, not enforcement — the engine accepts any string. */
export const valueSuggestions: { [s: string]: string[] } = Object.fromEntries(
  HandlerEvents.map((e) => [e, KnownHandlerNames[e]])
);

/** Default types for animation properties */
export const defaultTypes: { [s: string]: string } = {
  tween: 'string',
  duration: 'number',
  interpolate: 'bool',
  audio: 'string',
  cancellable: 'string',
  type: 'string',
  noCancel: 'string',
  iasa: 'number',
  early: 'number',
  late: 'number',
  handler: 'string',
  slid: 'string',
  transition: 'string',
  gravity: 'number',
  start: 'string',
  nodi: 'boolean',
  noFastfall: 'boolean',
  itan: 'boolean',
  interrupted: 'string',
  end: 'string',
  starKO: 'boolean',
  techable: 'boolean',
  bufferable: 'string',
  buffertime: 'number',
  platformDroppable: 'boolean',
  speed: 'number',
  slideFriction: 'number',
  friction: 'number',
  ungrabbable: 'boolean',
  effect: 'string',
  itanStart: 'number',
  itanEnd: 'number',
  grabDirections: 'number',
  helpless: 'boolean',
  disableIK: 'boolean',
  pause: 'number',
  reset: 'boolean',
  refresh: 'boolean',
  rooted: 'boolean',
  dx: 'number',
  dy: 'number',
  jumpSpeed: 'number',
  dashSpeed: 'number',
  acceleration: 'number',
  unbufferable: 'boolean',
  di: 'number',
  upward: 'number',
  fallFriction: 'number',
  noCancelInterrupt: 'boolean',
  jump: 'number',
  fullJump: 'number',
  alwaysHandle: 'boolean',
  specialDrop: 'boolean',
  shieldbrake: 'boolean',
  shielded: 'string',
  buffer: 'string',
  airdodgeSpeed: 'number',
  aerodynamics: 'number',
  airResistance: 'number',
  decay: 'number',
  pseudojump: 'boolean',
  ledgestall: 'boolean',
  holdingAnimation: 'string',
  heldAnimation: 'string',
  cost: 'number',
  noLedgeGrab: 'boolean',
  drain: 'number',
  release: 'string',
  drained: 'string',
  reversible: 'boolean',
  blocked: 'string',
  scale: 'number',
  // Hitbubble long-tail fields (offered in the per-hitbubble "other" editor).
  if: 'string',
  next: 'bool',
  color: 'array',
  addVelocity: 'number',
  shieldDamage: 'number',
  setLag: 'number',
  lag: 'number',
  onHit: 'string',
  onBlocked: 'string',
  // Object/array-valued overrides.
  redirect: 'object',
  spawn: 'object',
  events: 'array',
  hurtbubbleModelTransforms: 'object',
};

/** Properties to exclude from the general property editor */
export const excludeProps = new Set([
  'hitbubbles',
  'keyframes',
  'hurtbubbles',
  'hurtbubbleModelTransforms',
]);

/** Nudge delay for keyboard navigation (ms) */
export const NUDGE_DELAY = 120;

/** Animation speed for keyboard repeat (ms per tick) */
export const SPEED = 16;

/** Keyboard direction bit flags */
export const direction = {
  up: 1 << 0,
  left: 1 << 1,
  down: 1 << 2,
  right: 1 << 3,
};
