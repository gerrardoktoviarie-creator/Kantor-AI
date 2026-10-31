// Sprite atlas for the office staff.
//
// drawPerson builds a person out of ~150 fillRects, which is fine for one avatar but not for a
// dozen of them every frame. Instead each (look, pose, stride, rim) combination is rasterised once
// into an offscreen canvas and blitted with a single drawImage, so a person costs one blit a frame.

import { drawPerson } from './sprites.js';

// drawPerson draws a 16x32 art-pixel figure with its feet on the origin. The rim light overshoots
// the outlined parts by 2px, the dark outline by 1px, and the contact shadow reaches 1px past the
// feet, so the gutter keeps all of that inside the atlas.
const GUTTER_X = 3;
const GUTTER_TOP = 3;
const GUTTER_BOTTOM = 3;
const ART_W = 16 + GUTTER_X * 2; // 22
const ART_H = 32 + GUTTER_TOP + GUTTER_BOTTOM; // 38
const OX = ART_W / 2; // feet, x
const OY = ART_H - GUTTER_BOTTOM; // feet, y
// Staff are drawn at PERSON_SCALE * 1.45 in office-canvas.js, and the atlas is rasterised at that
// same size, so one entry can be reused at any zoom (zoom is applied by the scene transform).
const SCALE = 1.2 * 1.45;
const DW = Math.round(ART_W * SCALE);
const DH = Math.round(ART_H * SCALE);

function keyFor(look, pose, back, stride, rim) {
  return [
    look.hair, look.shirt, look.skin ?? '', look.style ?? 'short', look.glasses ? 1 : 0,
    pose, back ? 1 : 0, stride, rim ?? '',
  ].join('|');
}

export function createSpriteAtlas() {
  const cache = new Map(); // key -> canvas

  function render(look, pose, back, stride, rim) {
    const canvas = document.createElement('canvas');
    canvas.width = ART_W;
    canvas.height = ART_H;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    drawPerson(c, OX, OY, look, { pose, back, frame: stride, rim });
    return canvas;
  }

  /** Blits the sprite for `look` with its feet at (x, y) in the current transform space. */
  function draw(ctx, x, y, look, { pose = 'stand', back = false, frame = 0, rim = null } = {}) {
    // Only the standing pose has a walk cycle, and it flips on every other frame.
    const stride = pose === 'stand' && frame % 2 === 1 ? 1 : 0;
    const key = keyFor(look, pose, back, stride, rim);
    let canvas = cache.get(key);
    if (!canvas) {
      canvas = render(look, pose, back, stride, rim);
      cache.set(key, canvas);
    }
    ctx.drawImage(canvas, 0, 0, ART_W, ART_H,
      Math.round(x - OX * SCALE), Math.round(y - OY * SCALE), DW, DH);
  }

  /** Looks and rim colours are fixed for a session; a restyle should not leave stale art behind. */
  function invalidate() {
    cache.clear();
  }

  return { draw, invalidate, count: () => cache.size };
}