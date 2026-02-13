/**
 * Main bubble painting function
 * PERFORMANCE CRITICAL - Called on every canvas refresh, mouse move, and thumbnail render
 */

import type { EntityData, Animation, Hitbubble } from '../types';
import { objHas } from '../../utils';
import { pathCircle, pathCapsule } from './canvas-utils';
import { hbmap } from './bubble-finder';

/**
 * Paint all bubbles (hurtbubbles and hitbubbles) on a canvas
 *
 * PERFORMANCE CRITICAL:
 * - Called on every mouse move during drag
 * - Called for every thumbnail preview
 * - Keep allocations minimal
 * - Keep calculations efficient
 *
 * @param character Character entity data
 * @param animation Current animation
 * @param keyframe Keyframe index to render
 * @param ctx Canvas rendering context
 * @param ox Camera offset X (normalized -1 to 1)
 * @param oy Camera offset Y (normalized -1 to 1)
 * @param w Canvas width
 * @param h Canvas height
 * @param scale Camera zoom scale
 * @param highlight Bubble index to highlight (green)
 * @param active Bubble index to show as active (yellow)
 */
export const paintBubbles = (
  character: EntityData,
  animation: Animation,
  keyframe: number,
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  w: number,
  h: number,
  scale: number,
  highlight = -1,
  active = -1
) => {
  const kf = animation.keyframes[keyframe];
  const hurtbubbles = kf.hurtbubbles;
  const charhbs = character.hurtbubbles;
  let hitbubbles: Hitbubble[] = null;

  // Resolve hitbubbles (handle `true` reference to previous keyframe)
  if (objHas(kf, 'hitbubbles')) {
    let ckf = kf;
    let hbkf = keyframe;
    while (ckf.hitbubbles === true) {
      hbkf--;
      ckf = animation.keyframes[hbkf];
    }
    hitbubbles = ckf.hitbubbles;
  }

  // Convert normalized offsets to pixel coordinates
  ox = w * (0.5 + ox * 0.5);
  oy = h * (0.5 + oy * 0.5);

  // Draw origin grid (aligned to half-pixel offsets)
  ctx.beginPath();
  ctx.moveTo(0, (oy | 0) + 0.5);
  ctx.lineTo(w, (oy | 0) + 0.5);
  ctx.moveTo((ox | 0) + 0.5, 0);
  ctx.lineTo((ox | 0) + 0.5, h);
  ctx.strokeStyle = '#666';
  ctx.stroke();

  // Draw hitbubbles
  if (hitbubbles !== null) {
    const m = hbmap(charhbs);
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
    for (let i = 0; i < hitbubbles.length; i++) {
      const hb = hitbubbles[i];
      let x = 0;
      let y = 0;
      if (objHas(hb, 'x')) {
        x = hb.x;
      }
      if (objHas(hb, 'y')) {
        y = hb.y;
      }
      if (objHas(hb, 'follow')) {
        const hbindex = m.get(hb.follow);
        const b = charhbs[Math.abs(hbindex) - 1];
        const index = 4 * (hbindex > 0 ? b.i1 : b.i2);
        x = x + hurtbubbles[index];
        y = y + hurtbubbles[1 + index];
      }
      pathCircle(ctx, x * scale + ox, -y * scale + oy, hb.radius * scale);
      ctx.stroke();
      ctx.fill();
    }
  }

  // Draw hurtbubbles
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  const bones = character.hurtbubbles;
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    const hb1 = bone.i1 * 4;
    const hb2 = bone.i2 * 4;
    pathCapsule(
      ctx,
      hurtbubbles[hb1 + 0] * scale + ox,
      -hurtbubbles[hb1 + 1] * scale + oy,
      hurtbubbles[hb2 + 0] * scale + ox,
      -hurtbubbles[hb2 + 1] * scale + oy,
      hurtbubbles[hb1 + 2] * scale,
      4
    );
    ctx.stroke();
    ctx.fill();
  }

  // Draw highlight
  if (highlight >= 0) {
    ctx.strokeStyle = 'green';
    ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
    pathCircle(
      ctx,
      hurtbubbles[highlight * 4 + 0] * scale + ox,
      -hurtbubbles[highlight * 4 + 1] * scale + oy,
      hurtbubbles[highlight * 4 + 2] * scale
    );
    ctx.fill();
    ctx.stroke();
  }

  // Draw active
  if (active >= 0) {
    ctx.strokeStyle = 'yellow';
    ctx.fillStyle = 'rgba(255, 255, 0, 0.33)';
    pathCircle(
      ctx,
      hurtbubbles[active * 4 + 0] * scale + ox,
      -hurtbubbles[active * 4 + 1] * scale + oy,
      hurtbubbles[active * 4 + 2] * scale
    );
    ctx.fill();
    ctx.stroke();
  }

  // Draw hitbubble connections to hurtbubbles
  ctx.strokeStyle = 'rgba(100, 0, 0, 1)';
  if (hitbubbles !== null) {
    const m = hbmap(character.hurtbubbles);
    for (let i = 0; i < hitbubbles.length; i++) {
      const hb = hitbubbles[i];
      if (objHas(hb, 'follow')) {
        let x = 0;
        let y = 0;
        if (objHas(hb, 'x')) {
          x = hb.x;
        }
        if (objHas(hb, 'y')) {
          y = hb.y;
        }
        const hbindex = m.get(hb.follow);
        const b = charhbs[Math.abs(hbindex) - 1];
        const index = 4 * (hbindex > 0 ? b.i1 : b.i2);
        x = x + hurtbubbles[index];
        y = y + hurtbubbles[1 + index];

        ctx.beginPath();
        ctx.moveTo(x * scale + ox, -y * scale + oy);
        ctx.lineTo(hurtbubbles[index] * scale + ox, -hurtbubbles[1 + index] * scale + oy);
        ctx.stroke();
        pathCircle(ctx, x * scale + ox, -y * scale + oy, 3, 6);
        ctx.stroke();
      }
    }
  }

  // Draw highlight guide lines
  if (highlight >= 0) {
    const x = hurtbubbles[highlight * 4 + 0] * scale + ox;
    const y = -hurtbubbles[highlight * 4 + 1] * scale + oy;
    // const r = hurtbubbles[highlight * 4 + 2] * scale
    if (hurtbubbles[highlight * 4 + 1] === 0) {
      ctx.strokeStyle = 'rgba(64, 255, 64, 0.6)';
    } else {
      ctx.strokeStyle = 'rgba(64, 255, 64, 0.2)';
    }
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    if (hurtbubbles[highlight * 4 + 0] === 0) {
      ctx.strokeStyle = 'rgba(64, 255, 64, 0.6)';
    } else {
      ctx.strokeStyle = 'rgba(64, 255, 64, 0.2)';
    }
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
};
