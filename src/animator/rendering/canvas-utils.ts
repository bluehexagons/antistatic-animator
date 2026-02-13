/**
 * Canvas rendering utilities for drawing bubbles
 * PERFORMANCE CRITICAL - These functions are called frequently during rendering
 */

/** Reusable coordinate buffer to avoid allocations */
const working = [0, 0];

/** Helper to set coordinates in working buffer */
const point = (x: number, y: number) => {
  working[0] = x;
  working[1] = y;
};

/**
 * Draw a polygon approximating a circle
 * @param ctx Canvas rendering context
 * @param x Center X coordinate
 * @param y Center Y coordinate
 * @param r Radius
 * @param angles Number of polygon sides (default 8)
 */
export const pathCircle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  angles = 8
) => {
  let perp = -Math.PI;
  const step = (1 / angles) * Math.PI * 2;

  ctx.beginPath();
  point(x + Math.cos(perp) * r, y + Math.sin(perp) * r);
  ctx.moveTo(working[0], working[1]);
  for (let i = 0; i < angles; i++) {
    perp += step;
    point(x + Math.cos(perp) * r, y + Math.sin(perp) * r);
    ctx.lineTo(working[0], working[1]);
  }
  ctx.closePath();
};

/**
 * Draw a capsule shape between two points
 * @param ctx Canvas rendering context
 * @param x First point X
 * @param y First point Y
 * @param x2 Second point X
 * @param y2 Second point Y
 * @param r Radius
 * @param angles Number of arc segments per end (default 4)
 */
export const pathCapsule = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  r: number,
  angles = 4
) => {
  const rads = 2 * Math.PI - Math.atan2(x2 - x, y2 - y);
  let perp = rads - Math.PI;
  const step = (1 / angles) * Math.PI;

  ctx.beginPath();
  point(x + Math.cos(perp) * r, y + Math.sin(perp) * r);
  ctx.moveTo(working[0], working[1]);
  for (let i = 0; i < angles; i++) {
    perp += step;
    point(x + Math.cos(perp) * r, y + Math.sin(perp) * r);
    ctx.lineTo(working[0], working[1]);
  }
  perp = rads + Math.PI * 2;
  for (let i = 0; i < angles + 1; i++) {
    point(x2 + Math.cos(perp) * r, y2 + Math.sin(perp) * r);
    ctx.lineTo(working[0], working[1]);
    perp += step;
  }
  ctx.closePath();
};
