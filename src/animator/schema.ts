/**
 * Game schema mirror.
 *
 * Mirrors the engine-side enums and handler registries from
 * `../antistatic/app/src/game/{animation,bubbles}.ts` so the editor's
 * dropdowns, validation, and visualisation stay in lock-step with what
 * the runtime actually consumes.
 *
 * Keep this file as plain data — no imports from app/animator code —
 * so it can also be used from tests.
 */

/** AnimationType — `animation.ts:20` */
export const AnimationTypeNames = [
  'movement',
  'attack',
  'aerial',
  'special',
  'passive',
  'shield',
  'holding',
  'tumble',
  'throw',
] as const;
export type AnimationTypeName = (typeof AnimationTypeNames)[number];

/** HurtbubbleState — `bubbles.ts:39` */
export const HurtbubbleStates = [
  { id: 0, name: 'phased', color: '#3d475a', desc: 'No collision; cosmetic' },
  { id: 1, name: 'normal', color: '#cdd2dc', desc: 'Standard hurtbox' },
  { id: 2, name: 'lightArmor', color: '#f0a04b', desc: 'Reduced flinch' },
  { id: 3, name: 'heavyArmor', color: '#d97a2a', desc: 'No flinch under threshold' },
  { id: 4, name: 'invincible', color: '#ffe066', desc: 'Untouchable, blocks attacks' },
  { id: 5, name: 'intangible', color: '#6aa9ff', desc: 'Passes through attacks' },
  { id: 6, name: 'protected', color: '#7adea0', desc: 'Special defensive flag' },
  { id: 7, name: 'projectileArmor', color: '#b06aff', desc: 'Armor vs projectiles' },
  { id: 8, name: 'lightProjectileArmor', color: '#9b7be0', desc: 'Light projectile armor' },
  { id: 11, name: 'decoration', color: '#555c6a', desc: 'Visual only, no collision' },
] as const;

export const HurtbubbleStateById = new Map(HurtbubbleStates.map((s) => [s.id, s] as const));

/** HitbubbleType — `bubbles.ts:52` */
export const HitbubbleTypes = [
  'none',
  'ground',
  'aerial',
  'special',
  'object',
  'phasing',
  'grab',
  'shield',
  'wind',
  'projectile',
  'counter',
  'reflector',
  'throw',
] as const;
export type HitbubbleTypeName = (typeof HitbubbleTypes)[number];

/** HitbubbleFlag — `bubbles.ts:24`. Order = bit position (skip = 1<<1). */
export const HitbubbleFlags = [
  { name: 'skip', bit: 1 << 1, desc: 'Skip collision list' },
  { name: 'fixed', bit: 1 << 2, desc: 'Fixed knockback angle' },
  { name: 'ground', bit: 1 << 3, desc: 'Only hits grounded' },
  { name: 'air', bit: 1 << 4, desc: 'Only hits airborne' },
  { name: 'meteor', bit: 1 << 5, desc: 'Spike / downward force' },
  { name: 'wind', bit: 1 << 6, desc: 'No lag or stun' },
  { name: 'no_reverse', bit: 1 << 7, desc: 'Direction-locked' },
  { name: 'stale_di', bit: 1 << 8, desc: 'Stale DI bonus' },
  { name: 'no_stale', bit: 1 << 9, desc: 'Does not stale' },
  { name: 'no_self_lag', bit: 1 << 10, desc: 'No self-hitlag' },
  { name: 'no_stale_add', bit: 1 << 11, desc: 'Read staleness, don’t add' },
  { name: 'no_turnaround', bit: 1 << 12, desc: 'Don’t turn targets' },
] as const;

/** Default knockback colors (mirrors DefaultColors in bubbles.ts).
 *  Used for the gizmo/visualization tint. */
export const HitbubbleColors: Record<string, string> = {
  none: '#f06464',
  ground: '#f06464',
  aerial: '#ff8a4a',
  special: '#b06aff',
  projectile: '#5ad48f',
  grab: '#5ad48f',
  throw: '#5ad48f',
  shield: '#6aa9ff',
  wind: '#cdd2dc',
  counter: '#ffe066',
  reflector: '#80b6ff',
  electric: '#ffe066',
};

/** Handler event slots — `animation.ts:542` (`handlerEvents`).
 *  All keyframe / animation property slots that get rewritten from
 *  string to function during load. */
export const HandlerEvents = [
  'handler',
  'start',
  'end',
  'collided',
  'injured',
  'grabbed',
  'clashed',
  'interrupted',
  'blocked',
  'effect',
  'canceled',
  'spawn',
] as const;
export type HandlerEvent = (typeof HandlerEvents)[number];

/** Common handler names that show up across character JSONC.
 *  Not exhaustive — the game's defaultHandlers table is closed-source
 *  to us at runtime — but it covers the names actually used in the
 *  shipped data. Surfaced as datalist suggestions, not enforcement. */
export const KnownHandlerNames: Record<HandlerEvent, string[]> = {
  handler: [
    'walk',
    'teeter',
    'run',
    'dash',
    'jump',
    'fall',
    'land',
    'shield',
    'grab',
    'idle',
    'crouch',
    'air',
    'tumble',
    'helpless',
  ],
  start: ['startWalk', 'startRun', 'startJump', 'startGrab', 'startAir'],
  end: ['endWalk', 'endShield', 'endGrab', 'endAir'],
  collided: ['stop', 'bounce', 'absorb'],
  injured: ['flinch', 'launch', 'tumble', 'shieldHit'],
  grabbed: ['grabbed', 'thrown'],
  clashed: ['clash', 'rebound'],
  interrupted: ['ledgehit', 'walljump', 'cancel'],
  blocked: ['blocked', 'shieldHit'],
  effect: ['effect'],
  canceled: ['cancel', 'idle'],
  spawn: ['spawn'],
};

/** Tween names — names exported by the engine's @bluehexagons/easing
 *  package (mirrored in `src/easing.ts`). */
export const TweenNames = [
  'linear',
  'sineIn',
  'sineOut',
  'sineInOut',
  'quadIn',
  'quadOut',
  'quadInOut',
  'cubicIn',
  'cubicOut',
  'cubicInOut',
  'quartIn',
  'quartOut',
  'quartInOut',
  'quintIn',
  'quintOut',
  'quintInOut',
  'expoIn',
  'expoOut',
  'expoInOut',
  'circIn',
  'circOut',
  'circInOut',
  'backIn',
  'backOut',
  'backInOut',
  'bounceIn',
  'bounceOut',
  'bounceInOut',
  'elasticIn',
  'elasticOut',
  'elasticInOut',
];

/** Pack a set of flag names to the engine's bitmask. */
export const packFlags = (flags: readonly string[]): number => {
  let bits = 0;
  for (const f of flags) {
    const def = HitbubbleFlags.find((d) => d.name === f);
    if (def) bits |= def.bit;
  }
  return bits;
};

/** Unpack a bitmask to flag names. */
export const unpackFlags = (bits: number): string[] => {
  const out: string[] = [];
  for (const f of HitbubbleFlags) {
    if (bits & f.bit) out.push(f.name);
  }
  return out;
};
