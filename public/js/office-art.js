// Drawing for the office, seen isometrically: floors are diamonds and every box shows its
// top plus its two viewer-facing sides. Everything stays in tile units (x, y) plus height in
// art pixels (z); `corner` (built by isoCorner in iso.js) maps tiles to screen px, so the
// projection lives in one place and this file only draws through it.

// Art-pixel tile footprint of one iso tile (64x32 diamond), used by the sprite blits below.
export const TILE = 32;
// Height maps 1:1 to screen px: a desk 12px tall lifts its top exactly 12px up.
export const ZK = 1;
export const WALL = 40;
// Back walls stand taller than furniture heights would suggest, so what hangs on them reads.
const WALL_K = 1.5;
export const WALL_FACE = WALL * ZK * WALL_K;
export const MIMBAR_H = 14;
// Partition thickness in tiles, and its colours: charcoal with a cream trim, like the walls
// of an architect's floor plan.
const T = 0.18;
const CAP = '#2a2c33';
const CAP_SIDE = '#1b1d22';
const TRIM = '#e9dfca';

export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amount);
  const g = clamp(((n >> 8) & 0xff) + amount);
  const b = clamp((n & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Stable pseudo-random 0..1 per coordinate, so textures don't shimmer between frames.
export function hash(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// Iso boxes show three faces: the top catches the light, the +y face (left on screen) keeps
// its own colour, the +x face (right on screen) falls into shade.
const solid = (hex) => ({ top: shade(hex, 26), left: shade(hex, 4), right: shade(hex, -34) });

export const COLORS = {
  wood: solid('#8f5f3c'),
  darkWood: solid('#5a3b27'),
  lightWood: solid('#c39466'),
  metal: solid('#9aa3ad'),
  dark: solid('#2b2e36'),
  black: solid('#1f2127'),
  white: solid('#e9e4d9'),
  marble: solid('#e2dccf'),
  leather: solid('#5e3a28'),
  sofa: solid('#33456b'),
  navy: solid('#2d3c60'),
  teal: solid('#3f6b5a'),
  cream: solid('#e8dcc2'),
  cardboard: solid('#b98f5c'),
  terracotta: solid('#8a5a3c'),
  chair: solid('#2e3d63'),
  mimbar: solid('#6e4630'),
  beanbag: solid('#b9773f'),
  lounger: solid('#ece7dc'),
  cushion: solid('#33456b'),
};

export const MATERIALS = {
  marble: { base: ['#e1dacb', '#dad2c2'], line: '#c7bba4', vein: '#bcae95' },
  wood: { base: ['#ad7a50', '#a6744b'], line: '#7c5436' },
  woodLight: { base: ['#d0a676', '#c99f6f'], line: '#a77e55' },
  woodDark: { base: ['#76503a', '#704b35'], line: '#523624' },
  carpetBlue: { base: ['#34466c', '#314268'], dot: '#29395b' },
  carpetPurple: { base: ['#4b4566', '#474162'], dot: '#3d3858' },
  checker: { base: ['#e9e2d3', '#3f4657'] },
  tileGrey: { base: ['#a8acb2', '#a2a6ac'], line: '#8a8e95' },
  deck: { base: ['#a07049', '#996a44'], line: '#73502f' },
  prayer: { base: ['#3d6e50', '#39694c'], line: '#4b8160' },
  corridor: { base: ['#3f4249', '#3b3e45'], line: '#2e3036', vein: '#575a62' },
};

const BOOKS = ['#a8473b', '#33456b', '#c9a24a', '#4b7a5a', '#6b4f8a', '#b9773f', '#e9e4d9'];

export function createArt(ctx, corner) {
  const lift = (p, z) => ({ x: p.x, y: p.y - z * ZK });
  const at = (x, y, z = 0) => lift(corner(x, y), z);
  const mix = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

  function poly(points, fill, stroke, width = 0.6) {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function flat(x, y, w, d, fill, z = 0, stroke) {
    poly([at(x, y, z), at(x + w, y, z), at(x + w, y + d, z), at(x, y + d, z)], fill, stroke);
  }

  // An iso box shows its top and both viewer-facing sides: the +y face (screen-left) and the
  // +x face (screen-right). Face colours keep their old names: `left` is still the +y face.
  function box(x, y, w, d, h, colors, z = 0) {
    const edge = 'rgb(20 16 30 / 0.35)';
    const n = at(x, y, z), e = at(x + w, y, z), s = at(x + w, y + d, z), sw = at(x, y + d, z);
    poly([sw, s, lift(s, h), lift(sw, h)], colors.left, edge);
    poly([e, s, lift(s, h), lift(e, h)], colors.right, edge);
    poly([n, e, s, sw].map((p) => lift(p, h)), colors.top, edge);
  }

  // A rectangle painted on any vertical wall quad spanning screen points p0 -> p1, heights z0..z1.
  function wallQuad(p0, p1, z0, z1, fill) {
    poly([lift(p0, z0), lift(p1, z0), lift(p1, z1), lift(p0, z1)], fill);
  }
  // The +y face of something at depth `y`, from tile x0 to x1 — same helper as before, now
  // drawn on an iso edge that runs down-left across the screen.
  const front = (x0, x1, y, z0, z1, fill) => wallQuad(at(x0, y, 0), at(x1, y, 0), z0, z1, fill);

  function floorTile(name, x, y) {
    const m = MATERIALS[name];
    const base = m.base[(x + y) % 2];
    if (name === 'wood' || name === 'woodLight' || name === 'woodDark') {
      // Four planks per tile with staggered butt joints, the way boards are actually laid.
      for (let i = 0; i < 4; i++) {
        flat(x, y + i / 4, 1, 1 / 4, shade(m.base[0], Math.round((hash(x * 4 + i, y) - 0.5) * 16)), 0);
        flat(x, y + (i + 1) / 4 - 0.03, 1, 0.03, m.line);
        const seam = hash(x, y * 4 + i);
        if (seam > 0.4) flat(x + seam, y + i / 4, 0.03, 1 / 4, m.line);
      }
    } else if (name === 'deck') {
      for (let i = 0; i < 4; i++) {
        flat(x + i / 4, y, 1 / 4, 1, shade(m.base[0], Math.round((hash(x * 4 + i, y + 7) - 0.5) * 14)), 0);
        flat(x + (i + 1) / 4 - 0.03, y, 0.03, 1, m.line);
      }
    } else if (name === 'marble' || name === 'corridor') {
      flat(x, y, 1, 1, base, 0);
      flat(x, y, 1, 0.03, m.line);
      flat(x, y, 0.03, 1, m.line);
      // Veins wander across tile seams, so the floor reads as stone rather than a grid.
      if (hash(x, y) > 0.35) {
        poly([at(x + hash(y, x), y), at(x + 0.3 + hash(x, y + 1) * 0.4, y + 0.5), at(x + hash(x + 3, y), y + 1)], null, m.vein, 0.7);
      }
    } else if (name === 'carpetBlue' || name === 'carpetPurple') {
      flat(x, y, 1, 1, base);
      ctx.fillStyle = m.dot;
      for (let k = 0; k < 6; k++) {
        const p = at(x + hash(x * 7 + k, y), y + hash(x, y * 7 + k));
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    } else if (name === 'tileGrey') {
      // Half-tile ceramic squares with grout, like a server-room floor.
      for (const [u, v] of [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]) {
        flat(x + u, y + v, 0.5, 0.5, shade(base, Math.round((hash(x * 2 + u * 2, y * 2 + v * 2) - 0.5) * 8)), 0);
        flat(x + u, y + v, 0.5, 0.025, m.line);
        flat(x + u, y + v, 0.025, 0.5, m.line);
      }
    } else if (name === 'prayer') {
      flat(x, y, 1, 1, base, 0, m.line);
      // A little prayer-mat arch at the head of every tile.
      flat(x + 0.3, y + 0.12, 0.4, 0.22, m.line);
    } else {
      flat(x, y, 1, 1, base, 0, m.line);
    }
  }

  function skyline(p, q, lo, hi, night, seed, up = lift) {
    for (let i = 0; i < 4; i++) {
      const from = i / 4 + 0.02;
      const to = (i + 1) / 4 - 0.02;
      const top = lo + (hi - lo) * (0.35 + hash(seed, i) * 0.55);
      const color = night ? '#0f1830' : '#8fa8bd';
      poly([up(mix(p, q, from), lo), up(mix(p, q, to), lo), up(mix(p, q, to), top), up(mix(p, q, from), top)], color);
      if (night) {
        ctx.fillStyle = '#f4d06f';
        for (let k = 0; k < 3; k++) {
          if (hash(seed * 3 + k, i) < 0.5) continue;
          const w = up(mix(p, q, from + (to - from) * hash(i, k + seed)), lo + 2 + (top - lo - 4) * hash(k, i));
          poly([{ x: w.x - 1, y: w.y }, { x: w.x + 1, y: w.y - 1 }, { x: w.x + 1, y: w.y + 1 }, { x: w.x - 1, y: w.y + 2 }], '#2a2f45');
        }
      }
    }
  }

  // The back wall stands up behind the room, so whatever hangs on it faces the viewer.
  function backWall(room, night, now) {
    const { x, y, w } = room;
    const open = room.walls === 'glass' || room.walls === 'railing';
    const height = room.walls === 'railing' ? 10 : WALL;
    const up = (p, z) => lift(p, z * WALL_K);
    for (let i = 0; i < w; i++) {
      const p = corner(x + i, y);
      const q = corner(x + i + 1, y);
      const face = (from, to, lo, hi, fill) => wallQuad(mix(p, q, from), mix(p, q, to), lo * WALL_K, hi * WALL_K, fill);
      if (open) {
        if (room.walls === 'glass') skyline(p, q, 2, height - 2, night, x * 13 + i * 7, up);
        face(0, 1, 0, height, night ? 'rgb(120 160 210 / 0.22)' : 'rgb(190 220 240 / 0.3)');
        face(0, 1, height - 2, height, shade(room.wall, -10));
        face(0, 1, 0, 2, shade(room.wall, -20));
        face(0, 0.05, 0, height, CAP);
        continue;
      }
      face(0, 1, 0, height, room.wall);
      // Wainscot: a darker lower panel with a cream rail, then the skirting.
      face(0, 1, 0, 13, shade(room.wall, -18));
      face(0, 1, 13, 14.5, TRIM);
      face(0, 1, 0, 2.5, shade(room.wall, -40));
      const decal = room.decals.find((d) => d.wall === 'top' && d.at === i);
      if (decal) drawDecal(decal, face, p, q, night, now, up);
      else if (i % 2 === 1 && room.windows !== false) drawDecal({ type: 'window' }, face, p, q, night, now, up);
    }
    // The wall's top slab, continuous with the partitions on either side, plus a cream rail
    // laid along its near edge.
    box(x - T, y - T, w + 2 * T, T, height, { top: CAP, left: CAP_SIDE, right: CAP_SIDE }, 0);
    flat(x - T, y - T / 2, w + 2 * T, 0.03, TRIM, height);
  }

  // Side and front partitions are low enough to look over, like a cutaway floor plan.
  // They never change, so they go in the cached floor layer.
  function partitions(room) {
    const { x, y, w, h } = room;
    const glass = room.walls === 'glass';
    const railing = room.walls === 'railing';
    const height = railing ? 4 : 7;
    const body = glass ? { top: '#9fb3c6', left: '#6f8296', right: '#6f8296' }
      : railing ? { top: '#e9e4d9', left: '#b9b3a7', right: '#b9b3a7' }
        : { top: CAP, left: CAP_SIDE, right: CAP_SIDE };
    const trim = (x0, y0, w0, d0) => {
      if (!railing) flat(x0, y0, w0, d0, glass ? '#d6e6f2' : TRIM, height);
    };
    const doorY = y + room.doors.right;
    const doorX = x + room.doors.bottom;

    box(x - T, y, T, h, height, body);
    trim(x - T / 2 - 0.015, y, 0.03, h);
    box(x + w, y, T, doorY - y, height, body);
    box(x + w, doorY + 1, T, y + h - doorY - 1, height, body);
    trim(x + w + T / 2 - 0.015, y, 0.03, doorY - y);
    trim(x + w + T / 2 - 0.015, doorY + 1, 0.03, y + h - doorY - 1);
    box(x - T, y + h, doorX - x + T, T, height, body);
    box(doorX + 1, y + h, x + w + T - doorX - 1, T, height, body);
    trim(x - T, y + h + T / 2 - 0.015, doorX - x + T, 0.03);
    trim(doorX + 1, y + h + T / 2 - 0.015, x + w + T - doorX - 1, 0.03);
    // Door thresholds: a light strip where the floor changes.
    flat(doorX + 0.05, y + h, 0.9, T, '#c9a77c');
    flat(x + w, doorY + 0.05, T, 0.9, '#c9a77c');

    for (const decal of room.decals.filter((d) => d.wall === 'left')) sideDecal(decal, x, y + decal.at, height);
  }

  // Things mounted on the left wall, seen from above as a narrow strip against it.
  function sideDecal(decal, x, ty, height) {
    switch (decal.type) {
      case 'greenscreen':
        flat(x, ty, 0.14, 1, '#3a9a46');
        flat(x, ty, 0.04, 1, '#2c7a36');
        break;
      case 'tap':
        box(x + 0.02, ty + 0.2, 0.32, 0.6, 9, { top: '#dfe6ec', left: '#b9c3cc', right: '#b9c3cc' });
        flat(x + 0.08, ty + 0.32, 0.18, 0.36, '#9fc9dc', 9);
        break;
      case 'whiteboard':
        flat(x - 0.02, ty + 0.1, 0.12, 0.8, '#c9ced6', height);
        flat(x, ty + 0.14, 0.08, 0.72, '#f7f7f4', height);
        break;
      case 'clock':
        flat(x - 0.02, ty + 0.35, 0.12, 0.3, '#f1ece2', height);
        break;
      default: {
        const color = decal.color ?? (decal.type === 'painting' ? '#7c9cb6' : '#c9a24a');
        flat(x - 0.02, ty + 0.2, 0.12, 0.6, '#c9a24a', height);
        flat(x, ty + 0.25, 0.08, 0.5, color, height);
      }
    }
  }

  function drawDecal(decal, face, p, q, night, now, up) {
    // A small mark on the wall face: a stubby diamond that hugs the iso edge instead of an
    // axis-aligned square floating off a slanted wall.
    const dot = (t, z, w, h, color) => {
      const m = up(mix(p, q, t), z);
      poly([{ x: m.x, y: m.y - h / 2 }, { x: m.x + w, y: m.y }, { x: m.x, y: m.y + h / 2 }, { x: m.x - w, y: m.y }], color);
    };
    switch (decal.type) {
      case 'window':
        face(0.12, 0.88, 17, 36, '#e9dfca');
        face(0.17, 0.83, 19, 34, night ? '#16213b' : '#b9d6e6');
        skyline(mix(p, q, 0.17), mix(p, q, 0.83), 19, 30, night, Math.round(p.x + p.y), up);
        face(0.49, 0.51, 19, 34, '#e9dfca');
        break;
      case 'tv': {
        face(0.06, 0.94, 16, 36, '#151922');
        face(0.1, 0.9, 18, 34, '#22304c');
        // A live-looking bar chart.
        for (let i = 0; i < 5; i++) {
          const h = 3 + Math.round((Math.sin(now / 900 + i * 1.3) + 1) * 3.5);
          face(0.18 + i * 0.13, 0.27 + i * 0.13, 20, 20 + h, i % 2 ? '#7fb3a3' : '#c9a24a');
        }
        break;
      }
      case 'whiteboard':
        face(0.06, 0.94, 16, 37, '#c9ced6');
        face(0.1, 0.9, 18, 35, '#f7f7f4');
        dot(0.25, 32, 7, 1, '#a8473b');
        dot(0.28, 29, 5, 1, '#33456b');
        dot(0.55, 26, 8, 1, '#4b7a5a');
        break;
      case 'greenscreen':
        face(0, 1, 0, WALL - 4, '#3a9a46');
        face(0, 1, WALL - 6, WALL - 4, '#2c7a36');
        break;
      case 'poster':
        face(0.28, 0.72, 18, 36, decal.color);
        face(0.36, 0.64, 22, 32, '#efe6d2');
        break;
      case 'painting':
        face(0.2, 0.8, 18, 36, '#c9a24a');
        face(0.25, 0.75, 20, 34, '#7c9cb6');
        face(0.25, 0.75, 20, 25, '#4f7a4b');
        dot(0.6, 31, 2, 2, '#f4d06f');
        break;
      case 'logo':
        face(0.04, 0.96, 17, 36, '#20283b');
        face(0.04, 0.96, 17, 19, '#c9a24a');
        // Pixel "AI" mark.
        dot(0.32, 33, 1, 7, '#c9a24a');
        dot(0.32, 33, 4, 1, '#c9a24a');
        dot(0.43, 33, 1, 7, '#c9a24a');
        dot(0.32, 30, 4, 1, '#c9a24a');
        dot(0.6, 33, 1, 7, '#efe6d2');
        break;
      case 'clock': {
        const c = up(mix(p, q, 0.5), 29);
        // Wall clocks hang on the back wall, whose iso face runs down-left: squash on x.
        ctx.fillStyle = '#1b1626';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f1ece2';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 2.2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        const time = new Date();
        const hand = (angle, len) => {
          ctx.strokeStyle = '#1d1d1d';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + Math.sin(angle) * len * 0.6, c.y - Math.cos(angle) * len);
          ctx.stroke();
        };
        hand(((time.getHours() % 12) + time.getMinutes() / 60) / 12 * Math.PI * 2, 2.5);
        hand(time.getMinutes() / 60 * Math.PI * 2, 3.5);
        break;
      }
      case 'mihrab':
        face(0.04, 0.96, 0, WALL - 3, '#c8b27a');
        face(0.16, 0.84, 0, WALL - 11, '#2f5d43');
        face(0.26, 0.74, WALL - 11, WALL - 8, '#2f5d43');
        face(0.38, 0.62, WALL - 8, WALL - 6, '#2f5d43');
        face(0.16, 0.84, WALL - 12, WALL - 11, '#e8c766');
        break;
      case 'calligraphy':
        face(0.2, 0.8, 18, 34, '#1f4d35');
        face(0.22, 0.78, 19, 20, '#c9a24a');
        dot(0.32, 29, 6, 1, '#e8c766');
        dot(0.52, 32, 1, 3, '#e8c766');
        break;
      default:
        break;
    }
  }

  function leaves(cx, cy, size) {
    const greens = ['#2f6b3f', '#3e8550', '#559a63'];
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const r = size * (0.35 + hash(i, size) * 0.5);
      const lx = cx + Math.cos(angle) * r;
      const ly = cy - size * 0.5 + Math.sin(angle) * r * 0.8 - (i % 3);
      ctx.fillStyle = '#1b3a26';
      ctx.fillRect(Math.round(lx - 3), Math.round(ly - 2), 6, 5);
      ctx.fillStyle = greens[i % 3];
      ctx.fillRect(Math.round(lx - 2), Math.round(ly - 1), 4, 3);
    }
  }

  function item(it, { busy = false, night = false, now = 0 } = {}) {
    const { x, y, w = 1, d = 1 } = it;
    switch (it.type) {
      case 'desk': {
        const top = 12;
        for (const [lx, ly] of [[0.04, d - 0.1], [w - 0.1, d - 0.1]]) {
          box(x + lx, y + ly, 0.06, 0.06, top, COLORS.metal);
        }
        box(x, y, w, d, 2, COLORS.lightWood, top);
        const screen = busy ? '#5fb8a3' : night ? '#141a29' : '#2f3a52';
        for (const u of [0.06, 0.5]) {
          box(x + u + 0.17, y + 0.14, 0.05, 0.05, 4, COLORS.black, top + 2);
          box(x + u, y + 0.08, 0.38, 0.05, 10, { top: '#1f232d', left: screen, right: '#1f232d' }, top + 6);
          if (busy) {
            for (let k = 0; k < 3; k++) {
              const len = 0.1 + hash(k, Math.floor(now / 500) + (u > 0.3 ? 9 : 0)) * 0.18;
              front(x + u + 0.04, x + u + 0.04 + len, y + 0.13, top + 13 - k * 2.5, top + 13.8 - k * 2.5, k === 1 ? '#e8c766' : '#dff5ee');
            }
          }
        }
        box(x + 0.3, y + d - 0.24, 0.32, 0.12, 1, COLORS.white, top + 2);
        box(x + w - 0.16, y + d - 0.3, 0.08, 0.08, 3, COLORS.white, top + 2);
        break;
      }
      case 'chair':
        box(x + 0.3, y + 0.3, 0.4, 0.4, 1, COLORS.black);
        box(x + 0.24, y + 0.24, 0.52, 0.5, 3, COLORS.chair, 5);
        box(x + 0.24, y + 0.68, 0.52, 0.1, 9, COLORS.chair, 7);
        break;
      case 'reception':
        box(x, y, w, d, 14, COLORS.darkWood);
        box(x - 0.05, y - 0.05, w + 0.1, d + 0.1, 2, COLORS.marble, 14);
        front(x + 0.1, x + w - 0.1, y + d, 5, 7, '#c9a24a');
        break;
      case 'sofa': {
        const c = COLORS[it.color ?? 'leather'];
        box(x, y, w, d, 6, c);
        box(x, y, w, 0.25, 10, c, 6);
        box(x, y, 0.15, d, 5, c, 6);
        box(x + w - 0.15, y, 0.15, d, 5, c, 6);
        for (let i = 1; i < Math.round(w); i++) flat(x + i * w / Math.round(w) - 0.015, y + 0.27, 0.03, d - 0.3, shade(c.top, -18), 6);
        break;
      }
      case 'coffeeTable':
        box(x, y, w, d, 6, COLORS.darkWood);
        box(x + 0.1, y + 0.15, 0.2, 0.15, 2, COLORS.white, 6);
        break;
      case 'plant':
        box(x + 0.3, y + 0.34, 0.4, 0.36, 8, COLORS.terracotta);
        { const p = at(x + 0.5, y + 0.5, 8); leaves(p.x, p.y, it.tall ? 11 : 7); if (it.tall) leaves(p.x, p.y - 6, 8); }
        break;
      case 'bookshelf': {
        box(x, y, w, d, 34, COLORS.darkWood);
        for (const shelf of [3, 11, 19, 27]) {
          let u = 0.05;
          let n = 0;
          while (u < w - 0.08) {
            const bw = 0.05 + hash(n, shelf + Math.round(x * 10)) * 0.05;
            const bh = 5 + Math.round(hash(shelf, n + Math.round(y * 10)) * 2);
            front(x + u, x + u + bw, y + d, shelf, shelf + bh, BOOKS[(n + shelf) % BOOKS.length]);
            u += bw + 0.01;
            n++;
          }
        }
        break;
      }
      case 'rack':
        box(x, y, w, d, 34, COLORS.dark);
        for (let i = 0; i < 6; i++) {
          front(x + 0.1, x + w - 0.1, y + d, 4 + i * 5, 5 + i * 5, '#3a3e48');
          const on = (Math.floor(now / 350) + i + Math.round(x)) % 3 === 0;
          front(x + 0.15, x + 0.22, y + d, 6 + i * 5, 7 + i * 5, on ? '#5fb8a3' : '#1a1e29');
          front(x + 0.28, x + 0.35, y + d, 6 + i * 5, 7 + i * 5, (on && i % 2) ? '#e8c766' : '#1a1e29');
        }
        break;
      case 'counter':
        box(x, y, w, d, 13, COLORS.wood);
        box(x - 0.03, y - 0.03, w + 0.06, d + 0.06, 2, COLORS.marble, 13);
        for (let i = 1; i < w; i++) front(x + i - 0.01, x + i + 0.01, y + d, 1, 12, '#6e4a31');
        break;
      case 'coffee':
        box(x, y, 0.4, 0.35, 10, COLORS.black, 15);
        front(x + 0.12, x + 0.28, y + 0.35, 19, 22, '#a8473b');
        box(x + 0.14, y + 0.2, 0.1, 0.1, 3, COLORS.white, 15);
        break;
      case 'fridge':
        box(x, y, w, d, 36, COLORS.metal);
        front(x + 0.05, x + w - 0.05, y + d, 22, 23, '#7f8a96');
        front(x + w - 0.2, x + w - 0.16, y + d, 25, 32, '#5b6672');
        front(x + w - 0.2, x + w - 0.16, y + d, 12, 19, '#5b6672');
        break;
      case 'roundTable': {
        box(x + 0.44, y + 0.44, 0.12, 0.12, 10, COLORS.black);
        const pts = [];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          pts.push(at(x + 0.5 + Math.cos(a) * 0.38, y + 0.5 + Math.sin(a) * 0.38, 11));
        }
        poly(pts, '#efe8da', 'rgb(20 16 30 / 0.35)');
        break;
      }
      case 'stool':
        box(x + 0.45, y + 0.45, 0.08, 0.08, 7, COLORS.black);
        box(x + 0.3, y + 0.3, 0.4, 0.4, 2, COLORS.darkWood, 7);
        break;
      case 'longTable':
        for (const [lx, ly] of [[0.1, d - 0.18], [w - 0.18, d - 0.18]]) {
          box(x + lx, y + ly, 0.08, 0.08, 11, COLORS.black);
        }
        // Dark glass over a navy frame, like the boardroom table in the reference sketches.
        box(x, y, w, d, 2, COLORS.navy, 11);
        flat(x + 0.12, y + 0.12, w - 0.24, d - 0.24, 'rgb(150 175 205 / 0.18)', 13);
        box(x + w / 2 - 0.15, y + d / 2 - 0.1, 0.3, 0.2, 1, COLORS.white, 13);
        break;
      case 'beanbag':
        box(x + 0.1, y + 0.15, 0.8, 0.75, 4, COLORS.beanbag);
        box(x + 0.2, y + 0.15, 0.6, 0.3, 5, COLORS.beanbag, 4);
        break;
      case 'boxes':
        box(x + 0.05, y + 0.1, 0.45, 0.45, 8, COLORS.cardboard);
        box(x + 0.5, y + 0.4, 0.42, 0.42, 7, COLORS.cardboard);
        box(x + 0.15, y + 0.15, 0.35, 0.35, 7, COLORS.cardboard, 8);
        break;
      case 'shelving':
        for (const lvl of [0, 11, 22]) {
          box(x, y, w, d, 1, COLORS.metal, lvl + 6);
          box(x + 0.1, y + 0.1, 0.35, d - 0.2, 5, COLORS.cardboard, lvl + 7);
          box(x + 0.55, y + 0.1, 0.35, d - 0.2, 4, COLORS.cardboard, lvl + 7);
        }
        box(x, y + d - 0.06, 0.06, 0.06, 34, COLORS.metal);
        box(x + w - 0.06, y + d - 0.06, 0.06, 0.06, 34, COLORS.metal);
        break;
      case 'cabinet':
        box(x, y, w, d, 22, COLORS.metal);
        for (const z of [3, 10, 17]) {
          front(x + 0.08, x + w - 0.08, y + d, z, z + 5, '#b9c3cc');
          front(x + w / 2 - 0.06, x + w / 2 + 0.06, y + d, z + 3, z + 4, '#5b6672');
        }
        break;
      case 'lamp':
        box(x + 0.4, y + 0.4, 0.2, 0.2, 1, COLORS.black);
        box(x + 0.48, y + 0.48, 0.04, 0.04, 24, COLORS.black);
        box(x + 0.3, y + 0.3, 0.4, 0.4, 6, night ? solid('#ffe39a') : COLORS.cream, 24);
        break;
      case 'ringlight': {
        const p = at(x + 0.5, y + 0.5);
        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(Math.round(p.x), Math.round(p.y - 16), 1, 16);
        ctx.strokeStyle = '#fffbe6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 20, 4.5, 2.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'camera': {
        const p = at(x + 0.5, y + 0.5);
        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(Math.round(p.x - 4), Math.round(p.y), 1, 1);
        ctx.fillRect(Math.round(p.x + 4), Math.round(p.y), 1, 1);
        ctx.fillRect(Math.round(p.x), Math.round(p.y - 11), 1, 11);
        box(x + 0.15, y + 0.35, 0.7, 0.3, 4, solid('#2b2b2b'), 11);
        ctx.fillStyle = busy ? '#d9534f' : '#555555';
        ctx.fillRect(Math.round(p.x + 3), Math.round(p.y - 14), 1, 1);
        break;
      }
      case 'lounger':
        box(x + 0.1, y + 0.2, 0.8, d - 0.3, 3, COLORS.lounger);
        box(x + 0.15, y + 0.25, 0.7, d - 0.7, 2, COLORS.cushion, 3);
        box(x + 0.15, y + 0.25, 0.7, 0.3, 6, COLORS.cushion, 3);
        break;
      case 'umbrella': {
        box(x + 0.47, y + 0.47, 0.06, 0.06, 30, COLORS.white);
        const centre = at(x + 0.5, y + 0.5, 36);
        for (let i = 0; i < 8; i++) {
          const a0 = (i / 8) * Math.PI * 2;
          const a1 = ((i + 1) / 8) * Math.PI * 2;
          poly([centre, at(x + 0.5 + Math.cos(a0) * 0.9, y + 0.5 + Math.sin(a0) * 0.9, 30),
            at(x + 0.5 + Math.cos(a1) * 0.9, y + 0.5 + Math.sin(a1) * 0.9, 30)], i % 2 ? '#efe6d2' : '#33456b', 'rgb(20 16 30 / 0.3)');
        }
        break;
      }
      case 'mimbar':
        box(x, y, w, d, MIMBAR_H, COLORS.mimbar);
        box(x + 0.1, y + d, w - 0.2, 0.2, MIMBAR_H - 4, COLORS.mimbar);
        box(x + 0.1, y + d + 0.2, w - 0.2, 0.2, MIMBAR_H - 9, COLORS.mimbar);
        front(x + 0.15, x + w - 0.15, y + d + 0.4, 1, 4, '#c9a24a');
        break;
      case 'shoeRack':
        box(x, y, w, d, 7, COLORS.wood);
        for (let i = 0; i < 4; i++) box(x + 0.08 + i * 0.2, y + 0.2, 0.14, 0.3, 2, solid(BOOKS[i]), 7);
        break;
      default:
        // Chandeliers hang from a ceiling we don't draw; they only show as light at night.
        break;
    }
  }

  // Flat things that never move go in the cached floor layer: rugs and furniture shadows.
  function floorDetail(it) {
    const { x, y, w = 1, d = 1 } = it;
    if (it.type === 'rug') {
      flat(x, y, w, d, shade(it.color, -30));
      flat(x + 0.1, y + 0.1, w - 0.2, d - 0.2, it.color);
      // A border band and a medallion, like a woven office rug.
      flat(x + 0.2, y + 0.2, w - 0.4, 0.04, shade(it.color, 40));
      flat(x + 0.2, y + d - 0.24, w - 0.4, 0.04, shade(it.color, 40));
      if (w > 1.5 && d > 1.5) flat(x + w / 2 - 0.4, y + d / 2 - 0.3, 0.8, 0.6, shade(it.color, 26));
      return;
    }
    if (it.type === 'umbrella') {
      flat(x - 0.3, y - 0.1, 1.5, 1.4, 'rgb(0 0 0 / 0.14)');
      return;
    }
    // Small props (plants, lamps, cameras) have no footprint worth a shadow.
    if (it.shadow !== false && it.w) flat(x + 0.06, y + 0.12, w, d, 'rgb(0 0 0 / 0.18)');
  }

  // The pool is cut into the floor; the water moves, so it is drawn every frame.
  function pool(it, now) {
    const { x, y, w, d } = it;
    flat(x - 0.18, y - 0.18, w + 0.36, d + 0.36, '#e9e2d4', 0, '#cdc4b1');
    const a = at(x, y);
    const b = at(x + w, y);
    const d0 = at(x, y + d);
    // The two far inner walls of the pool catch the light differently, like any iso box.
    poly([d0, a, lift(a, -12), lift(d0, -12)], '#5da0b6');
    poly([a, b, lift(b, -12), lift(a, -12)], '#6fb3c8');
    flat(x, y, w, d, '#3a95b4', -7);
    ctx.fillStyle = 'rgb(255 255 255 / 0.5)';
    for (let i = 0; i < 14; i++) {
      const drift = ((now / 4000) + hash(i, 3)) % 1;
      const p = at(x + 0.1 + hash(i, 1) * (w - 0.2), y + 0.1 + ((hash(i, 2) + drift) % 1) * (d - 0.2), -7);
      const len = 2 + (i % 3);
      poly([{ x: p.x - len, y: p.y }, { x: p.x, y: p.y - len / 2 }, { x: p.x + len, y: p.y }, { x: p.x, y: p.y + len / 2 }], 'rgb(255 255 255 / 0.5)');
    }
    // Ladder on the far edge: rails drop straight down, rungs run parallel to the +y edge.
    const l = at(x + w - 0.6, y);
    const r = at(x + w - 0.6, y + 0.5);
    ctx.fillStyle = '#c9d1da';
    for (const q of [l, r]) poly([{ x: q.x, y: q.y - 2 }, { x: q.x + 1, y: q.y - 2 }, { x: q.x + 1, y: q.y + 8 }, { x: q.x, y: q.y + 8 }], '#c9d1da');
    for (const t of [2, 5, 8]) {
      poly([{ x: l.x, y: l.y + t }, { x: r.x, y: r.y + t }, { x: r.x, y: r.y + t + 1 }, { x: l.x, y: l.y + t + 1 }], '#c9d1da');
    }
  }

  return { poly, flat, box, floorTile, backWall, partitions, item, floorDetail, pool, at };
}
