const OUTLINE = '#1b1626';
const PANTS = '#2b2d42';
const SHOE = '#14151f';
const EYE = '#1b1626';
const DEFAULT_SKIN = '#f1c27d';

function tint(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amount);
  const g = clamp(((n >> 8) & 0xff) + amount);
  const b = clamp((n & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Hair or headwear seen from the front. `back` covers the whole head instead.
function headwear(part, look, back) {
  const hair = look.hair;
  const style = look.style ?? 'short';
  if (style === 'hijab') {
    part(-5, -27, 10, 11, hair, true);
    part(-6, -18, 12, 3, hair, true);
    if (!back) part(-3, -24, 6, 6, look.skin ?? DEFAULT_SKIN);
    return;
  }
  if (style === 'long') part(-5, -26, 10, 11, hair, true);
  if (style === 'bun') part(-2, -30, 4, 3, hair, true);
  if (style === 'peci') {
    part(-4, -28, 8, 3, '#1d1d1d', true);
  } else {
    part(-4, -27, 8, 3, hair, true);
  }
  if (style === 'spiky') {
    part(-3, -28, 1, 1, hair, true);
    part(0, -29, 1, 2, hair, true);
    part(2, -28, 1, 1, hair, true);
  }
  if (back) {
    part(-4, -26, 8, 8, hair, true);
    return;
  }
  part(-4, -24, 1, 3, hair);
  part(3, -24, 1, 3, hair);
  part(-2, -27, 3, 1, tint(hair, 40));
}

/**
 * Draws a 12x26 pixel person whose feet sit at (x, y). Coordinates are in art pixels.
 * pose: stand | sit | rukuk | sujud | swim. `back` turns them away from the viewer.
 * look: { hair, shirt, skin?, style?: short | long | bun | spiky | hijab | peci, glasses? }
 */
export function drawPerson(ctx, x, y, look, { frame = 0, sitting = false, pose = sitting ? 'sit' : 'stand', back = false } = {}) {
  const parts = [];
  const part = (dx, dy, w, h, color, outlined = false) => parts.push({ dx, dy, w, h, color, outlined });
  const skin = look.skin ?? DEFAULT_SKIN;
  const shirt = look.shirt;
  const shirtShade = tint(shirt, -38);

  ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
  ctx.fillRect(Math.round(x - 6), Math.round(y - 1), 12, 2);

  if (pose === 'sujud') {
    part(-4, -4, 8, 2, PANTS, true);
    part(-4, -2, 3, 2, SHOE, true);
    part(1, -2, 3, 2, SHOE, true);
    part(-6, -9, 12, 6, shirt, true);
    part(3, -9, 3, 6, shirtShade);
  } else if (pose === 'swim') {
    // Only head and shoulders show above the water line.
    part(-6, -5, 12, 3, skin, true);
    part(-4, -13, 8, 8, skin, true);
    headwearAt(part, look, back, 12);
    if (!back) {
      part(-2, -9, 1, 2, EYE);
      part(1, -9, 1, 2, EYE);
    }
  } else {
    const sit = pose === 'sit';
    const drop = sit ? 3 : 0;
    const walk = pose === 'stand' && frame % 2 === 1;

    if (sit) {
      part(-4, -2, 3, 2, SHOE, true);
      part(1, -2, 3, 2, SHOE, true);
      part(-4, -6, 3, 4, PANTS, true);
      part(1, -6, 3, 4, PANTS, true);
      part(-5, -8, 10, 3, PANTS, true);
    } else {
      part(-4, walk ? -3 : -2, 3, 2, SHOE, true);
      part(1, -2, 3, 2, SHOE, true);
      part(-4, walk ? -9 : -8, 3, 6, PANTS, true);
      part(1, -8, 3, 6, PANTS, true);
    }

    if (pose === 'rukuk') {
      // Bent forward: the flat of the back shows, the head is hidden in front of it.
      part(-6, -14, 12, 6, shirt, true);
      part(3, -14, 3, 6, shirtShade);
      part(-3, -15, 6, 1, look.style === 'hijab' ? look.hair : skin);
    } else {
      const swing = walk ? 1 : 0;
      part(-7, -15 + drop + swing, 2, 6, shirt, true);
      part(5, -15 + drop - swing, 2, 6, shirt, true);
      part(-7, -9 + drop + swing, 2, 2, skin);
      part(5, -9 + drop - swing, 2, 2, skin);
      part(-5, -16 + drop, 10, 8, shirt, true);
      part(3, -16 + drop, 2, 8, shirtShade);
      if (!back) part(-1, -16 + drop, 2, 1, skin);

      part(-4, -25 + drop, 8, 8, skin, true);
      headwearAt(part, look, back, drop);
      if (!back) {
        part(-2, -21 + drop, 1, 2, EYE);
        part(1, -21 + drop, 1, 2, EYE);
        if (look.glasses) {
          part(-3, -22 + drop, 3, 3, OUTLINE);
          part(1, -22 + drop, 3, 3, OUTLINE);
          part(-2, -21 + drop, 1, 1, '#cfe6f5');
          part(2, -21 + drop, 1, 1, '#cfe6f5');
        }
      }
    }
  }

  // Outlines first, so every part's fill sits on a 1px dark border.
  ctx.fillStyle = OUTLINE;
  for (const p of parts) {
    if (p.outlined) ctx.fillRect(Math.round(x + p.dx - 1), Math.round(y + p.dy - 1), p.w + 2, p.h + 2);
  }
  for (const p of parts) {
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(x + p.dx), Math.round(y + p.dy), p.w, p.h);
  }
}

// headwear() is drawn for a head whose top is at -27; `shift` moves it for sitting or swimming.
function headwearAt(part, look, back, shift) {
  headwear((dx, dy, w, h, color, outlined) => part(dx, dy + shift, w, h, color, outlined), look, back);
}

// A standing person is 16x32 art pixels with outline; avatars use canvases at whole multiples of that.
export function paintAvatar(canvas, look) {
  const ctx = canvas.getContext('2d');
  const k = Math.max(1, Math.floor(Math.min(canvas.width / 16, canvas.height / 32)));
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(k, k);
  drawPerson(ctx, 8, 31, look);
  ctx.restore();
}

export function avatarCanvas(look, className = 'avatar') {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 64;
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  paintAvatar(canvas, look);
  return canvas;
}
