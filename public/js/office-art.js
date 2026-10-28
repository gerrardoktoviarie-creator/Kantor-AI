// Drawing for the isometric office: floors, walls, wall decorations and furniture.
// Everything is in tile units (x, y) plus height in art pixels (z); `corner` maps tiles to art pixels.

export const TW = 32;
export const TH = 16;
export const WALL = 40;
export const MIMBAR_H = 14;

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

const solid = (hex) => ({ top: shade(hex, 22), left: hex, right: shade(hex, -24) });

export const COLORS = {
  wood: solid('#9a6a45'),
  darkWood: solid('#5e3f2b'),
  lightWood: solid('#c79c6e'),
  metal: solid('#a6b1bd'),
  dark: solid('#2b3142'),
  black: solid('#1f232d'),
  white: solid('#e9e6df'),
  marble: solid('#e6dfd0'),
  leather: solid('#8a4b32'),
  sofa: solid('#c8553d'),
  teal: solid('#2a9d8f'),
  cream: solid('#efe3c8'),
  cardboard: solid('#c49a63'),
  terracotta: solid('#b5653f'),
  chair: solid('#3a4157'),
  mimbar: solid('#7d5236'),
  beanbag: solid('#f28f3b'),
  lounger: solid('#f1efe8'),
  cushion: solid('#3f8fc4'),
};

export const MATERIALS = {
  marble: { base: ['#ece5d6', '#e4dccb'], line: '#d6cbb6', vein: '#c9bda5' },
  wood: { base: ['#b9845a', '#b27d54'], line: '#946542' },
  woodLight: { base: ['#d8b48a', '#d1ac82'], line: '#b58f66' },
  carpetBlue: { base: ['#5d7397', '#596f93'], dot: '#4c6186' },
  carpetPurple: { base: ['#7b6a9a', '#776696'], dot: '#685887' },
  checker: { base: ['#efe9dd', '#46536a'] },
  tileGrey: { base: ['#c9ced5', '#c2c8cf'], line: '#aab1bb' },
  deck: { base: ['#a8774f', '#a17149'], line: '#7c5536' },
  prayer: { base: ['#3f7a55', '#3b7350'], line: '#4f8d64' },
  corridor: { base: ['#3a4258', '#373f54'], line: '#31394c' },
};

const BOOKS = ['#e0607e', '#4aa3df', '#f4b942', '#2a9d8f', '#9b5de5', '#f28f3b', '#e9e6df'];

export function createArt(ctx, corner) {
  const lift = (p, z) => ({ x: p.x, y: p.y - z });
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

  function box(x, y, w, d, h, colors, z = 0) {
    const a = at(x, y, z);
    const b = at(x + w, y, z);
    const c = at(x + w, y + d, z);
    const e = at(x, y + d, z);
    const edge = 'rgb(20 16 30 / 0.35)';
    poly([e, c, lift(c, h), lift(e, h)], colors.left, edge);
    poly([b, c, lift(c, h), lift(b, h)], colors.right, edge);
    poly([a, b, c, e].map((p) => lift(p, h)), colors.top, edge);
  }

  // A rectangle painted on the front (+y) face of something at depth `y`, from tile x0 to x1, height z0..z1.
  function front(x0, x1, y, z0, z1, fill) {
    poly([at(x0, y, z0), at(x1, y, z0), at(x1, y, z1), at(x0, y, z1)], fill);
  }

  // Same on the right (+x) face at `x`, from tile y0 to y1.
  function side(x, y0, y1, z0, z1, fill) {
    poly([at(x, y0, z0), at(x, y1, z0), at(x, y1, z1), at(x, y0, z1)], fill);
  }

  function floorTile(name, x, y) {
    const m = MATERIALS[name];
    const base = m.base[(x + y) % 2];
    if (name === 'wood' || name === 'woodLight') {
      for (let i = 0; i < 4; i++) {
        flat(x, y + i / 4, 1, 1 / 4, shade(m.base[0], Math.round((hash(x * 4 + i, y) - 0.5) * 18)), 0, m.line);
        const seam = hash(x, y * 4 + i);
        if (seam > 0.45) poly([at(x + seam, y + i / 4), at(x + seam, y + (i + 1) / 4)], null, m.line);
      }
    } else if (name === 'deck') {
      for (let i = 0; i < 4; i++) {
        flat(x + i / 4, y, 1 / 4, 1, shade(m.base[0], Math.round((hash(x * 4 + i, y + 7) - 0.5) * 16)), 0, m.line);
      }
    } else if (name === 'marble') {
      flat(x, y, 1, 1, base, 0, m.line);
      if (hash(x, y) > 0.5) {
        poly([at(x + hash(y, x), y), at(x + 0.5, y + 0.5), at(x + hash(x + 3, y), y + 1)], null, m.vein, 0.5);
      }
    } else if (name === 'carpetBlue' || name === 'carpetPurple') {
      flat(x, y, 1, 1, base);
      ctx.fillStyle = m.dot;
      for (let k = 0; k < 6; k++) {
        const p = at(x + hash(x * 7 + k, y), y + hash(x, y * 7 + k));
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
    } else if (name === 'prayer') {
      flat(x, y, 1, 1, base, 0, m.line);
      // A little prayer-mat arch at the head of every tile.
      flat(x + 0.3, y + 0.12, 0.4, 0.22, m.line);
    } else {
      flat(x, y, 1, 1, base, 0, m.line);
    }
  }

  function skyline(p, q, lo, hi, night, seed) {
    for (let i = 0; i < 4; i++) {
      const from = i / 4 + 0.02;
      const to = (i + 1) / 4 - 0.02;
      const top = lo + (hi - lo) * (0.35 + hash(seed, i) * 0.55);
      const color = night ? '#0f1830' : '#9bb7cf';
      poly([lift(mix(p, q, from), lo), lift(mix(p, q, to), lo), lift(mix(p, q, to), top), lift(mix(p, q, from), top)], color);
      if (night) {
        ctx.fillStyle = '#f4d06f';
        for (let k = 0; k < 3; k++) {
          if (hash(seed * 3 + k, i) < 0.5) continue;
          const w = lift(mix(p, q, from + (to - from) * hash(i, k + seed)), lo + 2 + (top - lo - 4) * hash(k, i));
          ctx.fillRect(Math.round(w.x), Math.round(w.y), 1, 1);
        }
      }
    }
  }

  // One wall tile. Tile coords run from (x0, y0) to (x1, y1) along the room's back edge;
  // (bx, by) is the direction the wall's thickness goes, away from the room.
  function wall(room, segment, night, now) {
    const { x0, y0, x1, y1, bx, by, isTop, index } = segment;
    const p = corner(x0, y0);
    const q = corner(x1, y1);
    const height = room.walls === 'railing' ? 10 : WALL;
    const color = isTop ? room.wall : shade(room.wall, -16);
    const face = (from, to, lo, hi, fill) => poly(
      [lift(mix(p, q, from), lo), lift(mix(p, q, to), lo), lift(mix(p, q, to), hi), lift(mix(p, q, from), hi)], fill);
    const door = room.doors[isTop ? 'top' : 'left'] === index;

    if (room.walls === 'glass' || room.walls === 'railing') {
      if (!door) {
        if (room.walls === 'glass') skyline(p, q, 2, height - 2, night, x0 * 13 + y0 * 7);
        face(0, 1, 0, height, night ? 'rgb(120 160 210 / 0.22)' : 'rgb(190 225 245 / 0.35)');
        face(0, 1, height - 2, height, shade(room.wall, -10));
        face(0, 1, 0, 2, shade(room.wall, -20));
      }
      face(0, 0.06, 0, height, shade(room.wall, -28));
      face(0.94, 1, 0, height, shade(room.wall, -28));
      return;
    }

    if (door) {
      face(0, 1, height - 9, height, color);
      face(0, 0.08, 0, height - 9, shade(color, -28));
      face(0.92, 1, 0, height - 9, shade(color, -28));
    } else {
      face(0, 1, 0, height, color);
      face(0, 1, 0, 3, shade(color, -34));
      const decal = room.decals.find((d) => d.wall === (isTop ? 'top' : 'left') && d.at === index);
      if (decal) drawDecal(decal, face, p, q, night, now);
      else if (isTop && index % 2 === 1 && room.windows !== false) drawDecal({ type: 'window' }, face, p, q, night, now);
    }

    // Top edge of the wall, so it reads as a solid partition rather than paper.
    const cap = shade(room.wall, 34);
    poly([at(x0, y0, height), at(x1, y1, height), at(x1 + bx, y1 + by, height), at(x0 + bx, y0 + by, height)], cap, 'rgb(20 16 30 / 0.3)');
  }

  function drawDecal(decal, face, p, q, night, now) {
    const dot = (t, z, w, h, color) => {
      const m = lift(mix(p, q, t), z);
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(m.x), Math.round(m.y), w, h);
    };
    switch (decal.type) {
      case 'window':
        face(0.12, 0.88, 12, 34, '#ece6da');
        face(0.17, 0.83, 14, 32, night ? '#16213b' : '#bfe3f5');
        skyline(mix(p, q, 0.17), mix(p, q, 0.83), 14, 26, night, Math.round(p.x + p.y));
        face(0.49, 0.51, 14, 32, '#ece6da');
        face(0.17, 0.83, 22.5, 23.5, '#ece6da');
        break;
      case 'tv': {
        face(0.06, 0.94, 12, 32, '#151922');
        face(0.1, 0.9, 14, 30, '#22304c');
        // A live-looking bar chart.
        for (let i = 0; i < 5; i++) {
          const h = 4 + Math.round((Math.sin(now / 900 + i * 1.3) + 1) * 4);
          face(0.18 + i * 0.13, 0.27 + i * 0.13, 16, 16 + h, i % 2 ? '#5ec4b6' : '#f4b942');
        }
        break;
      }
      case 'whiteboard':
        face(0.06, 0.94, 10, 32, '#c9ced6');
        face(0.1, 0.9, 12, 30, '#ffffff');
        dot(0.25, 26, 7, 1, '#e0607e');
        dot(0.28, 23, 5, 1, '#4aa3df');
        dot(0.55, 20, 8, 1, '#2a9d8f');
        dot(0.6, 17, 4, 1, '#e0607e');
        break;
      case 'greenscreen':
        face(0, 1, 0, WALL - 4, '#3bb54a');
        face(0, 1, WALL - 6, WALL - 4, '#2c8a38');
        break;
      case 'poster':
        face(0.28, 0.72, 16, 32, decal.color);
        face(0.36, 0.64, 20, 28, '#f4f1de');
        break;
      case 'painting':
        face(0.2, 0.8, 15, 31, '#c9a24a');
        face(0.25, 0.75, 17, 29, '#7fb3d5');
        face(0.25, 0.75, 17, 22, '#4f8a4b');
        dot(0.6, 26, 2, 2, '#f4d06f');
        break;
      case 'logo':
        face(0.04, 0.96, 14, 32, '#1b2238');
        face(0.04, 0.96, 14, 16, '#f4b942');
        // Pixel "AI" mark.
        dot(0.32, 29, 1, 9, '#f4b942');
        dot(0.32, 29, 4, 1, '#f4b942');
        dot(0.43, 29, 1, 9, '#f4b942');
        dot(0.32, 25, 4, 1, '#f4b942');
        dot(0.6, 29, 1, 9, '#f4f1de');
        break;
      case 'clock': {
        const c = lift(mix(p, q, 0.5), 26);
        ctx.fillStyle = '#1b1626';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f4f1de';
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        const time = new Date();
        const hand = (angle, len) => {
          ctx.strokeStyle = '#1d1d1d';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + Math.sin(angle) * len * 0.8, c.y - Math.cos(angle) * len);
          ctx.stroke();
        };
        hand(((time.getHours() % 12) + time.getMinutes() / 60) / 12 * Math.PI * 2, 2.5);
        hand(time.getMinutes() / 60 * Math.PI * 2, 4);
        break;
      }
      case 'mihrab':
        face(0.04, 0.96, 0, WALL - 4, '#c8b27a');
        face(0.16, 0.84, 0, WALL - 12, '#2f5d43');
        face(0.26, 0.74, WALL - 12, WALL - 9, '#2f5d43');
        face(0.38, 0.62, WALL - 9, WALL - 7, '#2f5d43');
        face(0.16, 0.84, WALL - 13, WALL - 12, '#e8c766');
        dot(0.48, WALL - 17, 2, 3, '#f4b942');
        break;
      case 'calligraphy':
        face(0.2, 0.8, 14, 30, '#1f4d35');
        face(0.22, 0.78, 15, 16, '#c9a24a');
        dot(0.32, 25, 6, 1, '#f4b942');
        dot(0.36, 28, 1, 3, '#f4b942');
        dot(0.52, 29, 1, 4, '#f4b942');
        dot(0.6, 24, 3, 1, '#f4b942');
        break;
      case 'tap':
        face(0, 1, 0, 16, '#dfe6ec');
        face(0, 1, 16, 17, '#b9c3cc');
        dot(0.45, 20, 4, 1, '#8a96a3');
        dot(0.58, 19, 1, 3, '#8a96a3');
        break;
      default:
        break;
    }
  }

  function leaves(cx, cy, size) {
    const greens = ['#2f7d45', '#3f9a57', '#58b56c'];
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const r = size * (0.35 + hash(i, size) * 0.5);
      const lx = cx + Math.cos(angle) * r;
      const ly = cy - size * 0.6 + Math.sin(angle) * r * 0.7 - (i % 3) * 2;
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
        for (const [lx, ly] of [[0.04, 0.04], [w - 0.1, 0.04], [0.04, d - 0.1], [w - 0.1, d - 0.1]]) {
          box(x + lx, y + ly, 0.06, 0.06, top, COLORS.metal);
        }
        box(x, y, w, d, 2, COLORS.lightWood, top);
        const screen = busy ? '#3fb8a9' : night ? '#141a29' : '#33415c';
        for (const u of [0.06, 0.5]) {
          box(x + u + 0.17, y + 0.14, 0.05, 0.05, 4, COLORS.black, top + 2);
          box(x + u, y + 0.08, 0.38, 0.05, 10, { top: '#1f232d', left: screen, right: '#1f232d' }, top + 6);
          if (busy) {
            for (let k = 0; k < 3; k++) {
              const len = 0.1 + hash(k, Math.floor(now / 500) + (u > 0.3 ? 9 : 0)) * 0.18;
              front(x + u + 0.04, x + u + 0.04 + len, y + 0.13, top + 13 - k * 2.5, top + 13.8 - k * 2.5, k === 1 ? '#f4b942' : '#d6fff7');
            }
          }
        }
        box(x + 0.3, y + d - 0.24, 0.32, 0.12, 1, COLORS.white, top + 2);
        box(x + w - 0.16, y + d - 0.3, 0.08, 0.08, 3, COLORS.white, top + 2);
        break;
      }
      case 'chair':
        box(x + 0.36, y + 0.36, 0.28, 0.28, 1, COLORS.black);
        box(x + 0.47, y + 0.47, 0.06, 0.06, 5, COLORS.black);
        box(x + 0.24, y + 0.24, 0.52, 0.52, 2, COLORS.chair, 5);
        box(x + 0.24, y + 0.7, 0.52, 0.08, 9, COLORS.chair, 7);
        break;
      case 'reception':
        box(x, y, w, d, 14, COLORS.wood);
        box(x - 0.05, y - 0.05, w + 0.1, d + 0.1, 2, COLORS.marble, 14);
        front(x + 0.1, x + w - 0.1, y + d, 5, 8, '#f4b942');
        break;
      case 'sofa':
        box(x, y, w, d, 6, COLORS[it.color ?? 'leather']);
        box(x, y, w, 0.25, 10, COLORS[it.color ?? 'leather'], 6);
        box(x, y, 0.15, d, 5, COLORS[it.color ?? 'leather'], 6);
        box(x + w - 0.15, y, 0.15, d, 5, COLORS[it.color ?? 'leather'], 6);
        for (let i = 0; i < Math.round(w); i++) front(x + 0.2 + i * (w - 0.4) / Math.round(w), x + 0.18 + (i + 1) * (w - 0.4) / Math.round(w), y + d, 5, 6, shade(COLORS[it.color ?? 'leather'].left, 25));
        break;
      case 'coffeeTable':
        box(x, y, w, d, 6, COLORS.darkWood);
        box(x + 0.1, y + 0.15, 0.2, 0.15, 2, COLORS.white, 6);
        break;
      case 'plant':
        box(x + 0.32, y + 0.32, 0.36, 0.36, 8, COLORS.terracotta);
        { const p = at(x + 0.5, y + 0.5, 8); leaves(p.x, p.y, it.tall ? 14 : 8); if (it.tall) leaves(p.x, p.y - 10, 10); }
        break;
      case 'bookshelf': {
        box(x, y, w, d, 34, COLORS.darkWood);
        for (const shelf of [2, 10, 18, 26]) {
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
          front(x + 0.1, x + w - 0.1, y + d, 4 + i * 5, 5 + i * 5, '#3a4258');
          const on = (Math.floor(now / 350) + i + Math.round(x)) % 3 === 0;
          front(x + 0.15, x + 0.22, y + d, 6 + i * 5, 7 + i * 5, on ? '#5ec4b6' : '#1a1e29');
          front(x + 0.28, x + 0.35, y + d, 6 + i * 5, 7 + i * 5, (on && i % 2) ? '#f4b942' : '#1a1e29');
        }
        break;
      case 'counter':
        box(x, y, w, d, 13, COLORS.cream);
        box(x - 0.03, y - 0.03, w + 0.06, d + 0.06, 2, COLORS.marble, 13);
        for (let i = 1; i < w; i++) front(x + i - 0.01, x + i + 0.01, y + d, 1, 12, '#c9bfa6');
        break;
      case 'coffee':
        box(x, y, 0.4, 0.35, 10, COLORS.black, 15);
        front(x + 0.12, x + 0.28, y + 0.35, 19, 22, '#c0392b');
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
        poly(pts, '#f1ece2', 'rgb(20 16 30 / 0.35)');
        break;
      }
      case 'stool':
        box(x + 0.45, y + 0.45, 0.08, 0.08, 7, COLORS.black);
        box(x + 0.32, y + 0.32, 0.36, 0.36, 2, COLORS.teal, 7);
        break;
      case 'longTable':
        for (const [lx, ly] of [[0.1, 0.1], [w - 0.18, 0.1], [0.1, d - 0.18], [w - 0.18, d - 0.18]]) {
          box(x + lx, y + ly, 0.08, 0.08, 11, COLORS.black);
        }
        box(x, y, w, d, 2, COLORS.darkWood, 11);
        box(x + w / 2 - 0.15, y + d / 2 - 0.1, 0.3, 0.2, 1, COLORS.white, 13);
        break;
      case 'beanbag':
        box(x + 0.1, y + 0.1, 0.8, 0.8, 4, COLORS.beanbag);
        box(x + 0.2, y + 0.15, 0.6, 0.35, 5, COLORS.beanbag, 4);
        break;
      case 'boxes':
        box(x + 0.05, y + 0.1, 0.45, 0.45, 8, COLORS.cardboard);
        box(x + 0.5, y + 0.4, 0.42, 0.42, 7, COLORS.cardboard);
        box(x + 0.15, y + 0.15, 0.35, 0.35, 7, COLORS.cardboard, 8);
        front(x + 0.25, x + 0.3, y + 0.5, 8, 15, '#e8d3a8');
        break;
      case 'shelving':
        for (const lvl of [0, 11, 22]) {
          box(x, y, w, d, 1, COLORS.metal, lvl + 6);
          box(x + 0.1, y + 0.1, 0.35, d - 0.2, 5, COLORS.cardboard, lvl + 7);
          box(x + 0.55, y + 0.1, 0.35, d - 0.2, 4, COLORS.cardboard, lvl + 7);
        }
        box(x, y, 0.06, 0.06, 34, COLORS.metal);
        box(x + w - 0.06, y, 0.06, 0.06, 34, COLORS.metal);
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
        box(x + 0.45, y + 0.45, 0.1, 0.1, 1, COLORS.black);
        box(x + 0.48, y + 0.48, 0.04, 0.04, 26, COLORS.black);
        box(x + 0.32, y + 0.32, 0.36, 0.36, 6, night ? solid('#ffe39a') : COLORS.cream, 24);
        break;
      case 'ringlight': {
        const p = at(x + 0.5, y + 0.5);
        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(Math.round(p.x), Math.round(p.y - 28), 1, 28);
        ctx.strokeStyle = '#fffbe6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x + 0.5, p.y - 33, 5, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'camera': {
        const p = at(x + 0.5, y + 0.5);
        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(Math.round(p.x - 4), Math.round(p.y - 1), 1, 1);
        ctx.fillRect(Math.round(p.x + 4), Math.round(p.y - 1), 1, 1);
        ctx.fillRect(Math.round(p.x), Math.round(p.y - 18), 1, 18);
        ctx.fillRect(Math.round(p.x - 4), Math.round(p.y - 23), 8, 5);
        ctx.fillStyle = busy ? '#ef6f6c' : '#555555';
        ctx.fillRect(Math.round(p.x + 3), Math.round(p.y - 22), 1, 1);
        break;
      }
      case 'lounger':
        box(x + 0.1, y + 0.2, 0.8, d - 0.3, 3, COLORS.lounger);
        box(x + 0.15, y + 0.25, 0.7, d - 0.7, 2, COLORS.cushion, 3);
        box(x + 0.15, y + d - 0.45, 0.7, 0.25, 7, COLORS.cushion, 3);
        break;
      case 'umbrella': {
        box(x + 0.47, y + 0.47, 0.06, 0.06, 30, COLORS.white);
        const centre = at(x + 0.5, y + 0.5, 36);
        for (let i = 0; i < 8; i++) {
          const a0 = (i / 8) * Math.PI * 2;
          const a1 = ((i + 1) / 8) * Math.PI * 2;
          poly([centre, at(x + 0.5 + Math.cos(a0) * 0.9, y + 0.5 + Math.sin(a0) * 0.9, 28),
            at(x + 0.5 + Math.cos(a1) * 0.9, y + 0.5 + Math.sin(a1) * 0.9, 28)], i % 2 ? '#f4f1de' : '#e0607e', 'rgb(20 16 30 / 0.3)');
        }
        break;
      }
      case 'mimbar':
        box(x, y, w, d, MIMBAR_H, COLORS.mimbar);
        box(x + 0.1, y + d, w - 0.2, 0.2, MIMBAR_H - 4, COLORS.mimbar);
        box(x + 0.1, y + d + 0.2, w - 0.2, 0.2, MIMBAR_H - 9, COLORS.mimbar);
        box(x - 0.05, y + 0.1, 0.06, 0.06, 10, COLORS.mimbar, MIMBAR_H);
        box(x + w, y + 0.1, 0.06, 0.06, 10, COLORS.mimbar, MIMBAR_H);
        front(x + 0.15, x + w - 0.15, y + d + 0.4, 1, 4, '#c9a24a');
        break;
      case 'shoeRack':
        box(x, y, w, d, 7, COLORS.wood);
        for (let i = 0; i < 4; i++) box(x + 0.08 + i * 0.2, y + 0.2, 0.14, 0.3, 2, solid(BOOKS[i]), 7);
        break;
      case 'chandelier': {
        const top = at(x + 0.5, y + 0.5, WALL + 4);
        const lampAt = at(x + 0.5, y + 0.5, WALL - 6);
        ctx.fillStyle = '#c9a24a';
        ctx.fillRect(Math.round(top.x), Math.round(top.y), 1, Math.round(lampAt.y - top.y));
        ctx.fillRect(Math.round(lampAt.x - 4), Math.round(lampAt.y), 9, 2);
        ctx.fillStyle = night ? '#ffe39a' : '#f4f1de';
        ctx.fillRect(Math.round(lampAt.x - 3), Math.round(lampAt.y + 2), 7, 3);
        break;
      }
      default:
        break;
    }
  }

  // Flat things that never move go in the cached floor layer: rugs and furniture shadows.
  function floorDetail(it) {
    const { x, y, w = 1, d = 1 } = it;
    if (it.type === 'rug') {
      flat(x, y, w, d, shade(it.color, -30));
      flat(x + 0.1, y + 0.1, w - 0.2, d - 0.2, it.color);
      if (w > 1.5 && d > 1.5) flat(x + w / 2 - 0.4, y + d / 2 - 0.3, 0.8, 0.6, shade(it.color, 26));
      return;
    }
    if (it.type === 'umbrella') {
      flat(x - 0.3, y - 0.1, 1.5, 1.4, 'rgb(0 0 0 / 0.14)');
      return;
    }
    // Small props (plants, lamps, cameras) have no footprint worth a shadow.
    if (it.shadow !== false && it.w) flat(x + 0.1, y + 0.1, w, d, 'rgb(0 0 0 / 0.16)');
  }

  // The pool is cut into the floor; the water moves, so it is drawn every frame.
  function pool(it, now) {
    const { x, y, w, d } = it;
    flat(x - 0.18, y - 0.18, w + 0.36, d + 0.36, '#ebe4d6', 0, '#cfc6b4');
    const a = at(x, y);
    const b = at(x + w, y);
    const e = at(x, y + d);
    poly([a, b, lift(b, -9), lift(a, -9)], '#7fc8dc');
    poly([a, e, lift(e, -9), lift(a, -9)], '#5fb4cc');
    flat(x, y, w, d, '#36a9cc', -4);
    ctx.fillStyle = 'rgb(255 255 255 / 0.55)';
    for (let i = 0; i < 14; i++) {
      const drift = ((now / 4000) + hash(i, 3)) % 1;
      const p = at(x + 0.1 + hash(i, 1) * (w - 0.2), y + 0.1 + ((hash(i, 2) + drift) % 1) * (d - 0.2), -4);
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 3 + (i % 3), 1);
    }
    // Ladder on the far edge.
    const l = at(x + w - 0.6, y);
    ctx.fillStyle = '#c9d1da';
    ctx.fillRect(Math.round(l.x), Math.round(l.y - 8), 1, 12);
    ctx.fillRect(Math.round(l.x + 5), Math.round(l.y - 5), 1, 12);
  }

  return { poly, flat, box, floorTile, wall, item, floorDetail, pool, at };
}
