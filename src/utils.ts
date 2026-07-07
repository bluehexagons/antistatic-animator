/**
 * Small shared utilities. Storage and watching has moved to `./storage/`.
 */

export const objHas = (o: object, prop: string | number | symbol) =>
  Object.prototype.hasOwnProperty.call(o, prop);
