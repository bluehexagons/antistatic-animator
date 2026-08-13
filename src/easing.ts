import * as Easing from '@bluehexagons/easing';
import { easings, type EasingName } from '@bluehexagons/easing/named';

export const Ease = Easing;

/** Resolve an easing function by name, falling back to linear for unknown names. */
export const easeFn = (name: string | undefined): Easing.EasingFunction => {
  if (name && Object.hasOwn(easings, name)) {
    return easings[name as EasingName];
  }
  return Easing.linear;
};
