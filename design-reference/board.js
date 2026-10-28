'use strict';

// Same looks as server/agents.js, so the board and the app never drift apart silently.
const AGENTS = [
  { id: 'builder', name: 'Builder', role: 'Pengurus Kantor', look: { hair: '#5c4033', shirt: '#f4f1de' } },
  { id: 'sari', name: 'Sari', role: 'Manajer Konten', look: { hair: '#3b2416', shirt: '#e0607e' } },
  { id: 'ale', name: 'Ale', role: 'Creative Lead', look: { hair: '#5a3825', shirt: '#4aa3df' } },
  { id: 'dimas', name: 'Dimas', role: 'Editor Klip', look: { hair: '#1c1c1c', shirt: '#f2994a' } },
  { id: 'bayu', name: 'Bayu', role: 'Lead Programmer', look: { hair: '#222222', shirt: '#2d6a4f' } },
  { id: 'nadia', name: 'Nadia', role: 'Riset Ide', look: { hair: '#6b3e26', shirt: '#9b5de5' } },
  { id: 'tari', name: 'Tari', role: 'Desainer UI', look: { hair: '#d4a373', shirt: '#ef476f' } },
  { id: 'joko', name: 'Joko', role: 'Database', look: { hair: '#2b2b2b', shirt: '#118ab2' } },
  { id: 'fajar', name: 'Fajar', role: 'Backend', look: { hair: '#3d2b1f', shirt: '#073b4c' } },
  { id: 'rani', name: 'Rani', role: 'Frontend', look: { hair: '#8d5524', shirt: '#06d6a0' } },
  { id: 'mira', name: 'Mira', role: 'Asisten Tugas', look: { hair: '#4a2c2a', shirt: '#ffd166' } },
];
const lookOf = (id) => AGENTS.find((a) => a.id === id).look;

const SWATCHES = {
  base: [
    ['Background', '#121a2e', 'Latar halaman (gelap)'],
    ['Panel', '#1b2540', 'Kartu, topbar'],
    ['Panel 2', '#222e4f', 'Isi dalam kartu, bubble agent'],
    ['Garis', '#2f3c62', 'Border, pemisah'],
    ['Teks', '#edf0f7', 'Teks utama'],
    ['Muted', '#9ba6c2', 'Teks kedua, label'],
    ['Aksen', '#f4b942', 'Giliran kamu: tombol primer'],
    ['Tinta aksen', '#2a1d00', 'Teks di atas kuning'],
    ['BG terang', '#f6f3ec', 'Latar mode terang'],
    ['Teks terang', '#1b2238', 'Teks mode terang'],
    ['Amber teks', '#8a5a00', 'Aksen sebagai teks di mode terang'],
  ],
  state: [
    ['Kerja', '#5ec4b6', 'Monitor nyala, badge kerja'],
    ['Teal Huemint', '#00a598', 'Kerja di mode terang'],
    ['Nunggu kamu', '#f4b942', 'Gelembung "!", badge'],
    ['Error', '#ef6f6c', 'Tugas gagal'],
    ['Ngobrol / rapat', '#b8a1ff', 'Chat & kickoff'],
    ['Beres', '#2c5a46', 'Disetujui, klip jadi'],
  ],
  division: [
    ['Sosmed', '#e0607e', 'Studio Sosmed'],
    ['IT', '#4aa3df', 'Lab IT'],
    ['Tugas', '#f4b942', 'Ruang Belajar'],
    ['Live / rekam', '#ee6230', 'Oranye Huemint: lampu REC, video'],
  ],
};

const CONTRAST = [
  ['Teks', '#edf0f7', '#121a2e'],
  ['Muted di panel 2', '#9ba6c2', '#222e4f'],
  ['Tombol primer', '#2a1d00', '#f4b942'],
  ['Badge kerja', '#062b26', '#5ec4b6'],
  ['Badge error', '#2b0605', '#ef6f6c'],
  ['Badge rapat', '#111827', '#b8a1ff'],
  ['Oranye di latar', '#ee6230', '#121a2e'],
  ['Teks terang', '#1b2238', '#f6f3ec'],
  ['Muted terang', '#5a6278', '#ffffff'],
  ['Amber teks terang', '#8a5a00', '#ffffff'],
  ['Tinta gelap di teal', '#062b26', '#00a598'],
  ['Putih di teal (jebakan)', '#ffffff', '#00a598'],
];

const ROOMS = [
  { name: 'Lobby', floor: ['#c9b48f', '#c2ac86'], wall: '#8aa0c8', items: 'Meja Builder, sofa merah, karpet, TV, jam dinding asli' },
  { name: 'Studio Sosmed', floor: ['#d8a7a0', '#d09d96'], wall: '#9b7fb8', items: 'Green screen, ring light, kamera (lampu merah saat kerja)' },
  { name: 'Lab IT', floor: ['#9fb6c9', '#97aec1'], wall: '#5f7fa6', items: '6 meja, rak server dengan lampu kedip' },
  { name: 'Ruang Belajar', floor: ['#b7c99f', '#afc197'], wall: '#7f9a6a', items: 'Rak buku, bean bag, whiteboard' },
  { name: 'Ruang rapat', floor: ['#b9a5c9', '#b19dc1'], wall: '#7d6a9b', items: 'Meja panjang 10 kursi, whiteboard, karpet ungu' },
  { name: 'Pantry', floor: ['#e2d3b0', '#dacba8'], wall: '#b08f5f', items: 'Counter, mesin kopi, kulkas, meja ngobrol' },
];

const SKIN = '#f1c27d';
const PANTS = '#2b2d42';
const SHOE = '#14151f';

function drawPerson(ctx, x, y, look, opts) {
  const frame = opts?.frame ?? 0;
  const sitting = opts?.sitting ?? false;
  const px = (dx, dy, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + dx), Math.round(y + dy), w, h);
  };
  px(-4, -1, 8, 2, 'rgb(0 0 0 / 0.25)');
  if (sitting) {
    px(-3, -5, 6, 3, PANTS);
  } else {
    const step = frame % 2;
    px(-3, -5 + step, 2, 4 - step, PANTS);
    px(1, -4 - step, 2, 3 + step, PANTS);
    px(-3, -1, 2, 1, SHOE);
    px(1, -1, 2, 1, SHOE);
  }
  const top = sitting ? -13 : -12;
  px(-4, top, 8, 7, look.shirt);
  px(-5, top + 1, 1, 5, look.shirt);
  px(4, top + 1, 1, 5, look.shirt);
  px(-5, top + 6, 1, 1, SKIN);
  px(4, top + 6, 1, 1, SKIN);
  px(-3, top - 6, 6, 6, SKIN);
  px(-3, top - 7, 6, 2, look.hair);
  px(-4, top - 6, 1, 3, look.hair);
  px(3, top - 6, 1, 3, look.hair);
  px(-2, top - 3, 1, 1, '#1d1d1d');
  px(1, top - 3, 1, 1, '#1d1d1d');
}

function avatar(canvas, look) {
  const ctx = canvas.getContext('2d');
  const k = Math.max(1, Math.floor(Math.min(canvas.width / 12, canvas.height / 22)));
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawPerson(ctx, 6, 21, look);
}

function newAvatar(look, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = 12 * scale;
  canvas.height = 22 * scale;
  canvas.setAttribute('aria-hidden', 'true');
  avatar(canvas, look);
  return canvas;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

const hook = (name) => document.querySelector(`[data-hook="${name}"]`);

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function renderSwatches() {
  for (const [group, list] of Object.entries(SWATCHES)) {
    const items = list.map(([name, hex, role]) => {
      const button = el('button', 'swatch');
      button.type = 'button';
      button.dataset.hex = hex;
      button.setAttribute('aria-label', `Salin ${name} ${hex}`);
      const chip = el('span', 'swatch__chip');
      chip.style.background = hex;
      button.append(chip, el('span', 'swatch__name', name), el('span', 'swatch__hex', hex), el('span', 'swatch__role', role));
      return button;
    });
    hook(`swatches-${group}`).replaceChildren(...items);
  }

  document.addEventListener('click', async (event) => {
    const swatch = event.target.closest('.swatch');
    if (!swatch) return;
    const label = swatch.querySelector('.swatch__hex');
    try {
      await navigator.clipboard.writeText(swatch.dataset.hex);
      label.textContent = 'Kesalin!';
    } catch {
      label.textContent = 'Salin manual';
    }
    setTimeout(() => {
      label.textContent = swatch.dataset.hex;
    }, 1200);
  });
}

function renderContrast() {
  const rows = CONTRAST.map(([name, fg, bg]) => {
    const ratio = contrast(fg, bg);
    const tr = el('tr');
    const sampleCell = el('td');
    const sample = el('span', 'sample', 'Aa Kantor');
    sample.style.color = fg;
    sample.style.background = bg;
    sampleCell.append(sample);

    const pair = el('td');
    pair.append(el('span', '', name), el('br'), el('code', '', `${fg} / ${bg}`));

    let verdict = ['Gagal', ''];
    if (ratio >= 4.5) verdict = ['Lolos AA', 'verdict--pass'];
    else if (ratio >= 3) verdict = ['Teks besar saja', 'verdict--large'];

    tr.append(sampleCell, pair, el('td', '', `${ratio.toFixed(2)} : 1`), el('td', `verdict ${verdict[1]}`, verdict[0]));
    return tr;
  });
  hook('contrast-rows').replaceChildren(...rows);
}

function renderCast() {
  hook('hero-cast').replaceChildren(...AGENTS.map((a) => newAvatar(a.look, 4)));
  hook('cast').replaceChildren(...AGENTS.map((agent) => {
    const card = el('div', 'cast__member');
    const swatches = el('div', 'room__chips');
    for (const color of [agent.look.hair, agent.look.shirt]) {
      const chip = el('span', 'room__chip');
      chip.style.background = color;
      chip.title = color;
      swatches.append(chip);
    }
    card.append(newAvatar(agent.look, 3), el('span', 'cast__name', agent.name), el('span', 'cast__role', agent.role), swatches);
    return card;
  }));
  for (const canvas of document.querySelectorAll('canvas[data-look]')) avatar(canvas, lookOf(canvas.dataset.look));
}

function renderRooms() {
  hook('rooms').replaceChildren(...ROOMS.map((room) => {
    const card = el('div', 'room');
    const chips = el('div', 'room__chips');
    for (const color of [...room.floor, room.wall]) {
      const chip = el('span', 'room__chip');
      chip.style.background = color;
      chip.title = color;
      chips.append(chip);
    }
    card.append(el('strong', '', room.name), chips, el('p', 'room__items', room.items));
    return card;
  }));
}

function pill(ctx, text, x, y, bg, fg) {
  ctx.font = '600 10px "Plus Jakarta Sans", system-ui, sans-serif';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 8, w, 16, 8);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

function renderPoses(time) {
  const canvas = hook('poses');
  const ctx = canvas.getContext('2d');
  const k = 3;
  const poses = [
    { label: 'Santai', agent: 'dimas' },
    { label: 'Jalan', agent: 'rani', walk: true },
    { label: 'Kerja', agent: 'sari', sitting: true, desk: true, bubble: ['Nulis reels', '#5ec4b6', '#062b26'] },
    { label: 'Nunggu', agent: 'bayu', desk: true, bubble: ['! Cek proyek', '#f4b942', '#2a1d00'] },
    { label: 'Error', agent: 'nadia', desk: true, bubble: ['9router mati', '#ef6f6c', '#2b0605'] },
    { label: 'Ngobrol', agent: 'mira', bubble: ['…', 'rgb(237 240 247 / 0.9)', '#2a3350'] },
  ];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  poses.forEach((pose, i) => {
    const cx = 45 + i * 86;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const bob = pose.sitting ? Math.floor(time / 450) % 2 : 0;
    drawPerson(ctx, cx / k, 36 + bob, lookOf(pose.agent), { frame: pose.walk ? Math.floor(time / 160) : 0, sitting: pose.sitting });
    if (pose.desk) {
      ctx.fillStyle = '#8e6040';
      ctx.fillRect(cx / k - 7, 33, 14, 5);
      ctx.fillStyle = pose.sitting ? '#5ec4b6' : '#2b3550';
      ctx.fillRect(cx / k - 4, 27, 8, 5);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (pose.bubble) pill(ctx, pose.bubble[0], cx, 22, pose.bubble[1], pose.bubble[2]);
    ctx.fillStyle = '#9ba6c2';
    ctx.font = '400 11px Silkscreen, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pose.label, cx, 140);
  });
}

function renderMiniOffice(time) {
  const canvas = hook('mini-office');
  const ctx = canvas.getContext('2d');
  const TW = 24;
  const TH = 12;
  // Drawn at 2x so the sprites stay crisp; the canvas element is 2x the art size.
  const k = 2;
  const origin = { x: canvas.width / k / 2 - 12, y: 40 };
  const p = (tx, ty) => ({ x: (tx - ty) * TW / 2 + origin.x, y: (tx + ty) * TH / 2 + origin.y });
  const poly = (pts, fill) => {
    ctx.beginPath();
    pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const rooms = [
    { x: 0, y: 0, floor: ['#d8a7a0', '#d09d96'], wall: '#9b7fb8' },
    { x: 6, y: 0, floor: ['#9fb6c9', '#97aec1'], wall: '#5f7fa6' },
    { x: 0, y: 5, floor: ['#e2d3b0', '#dacba8'], wall: '#b08f5f' },
  ];
  for (const r of rooms) {
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 4; j++) {
        poly([p(r.x + i, r.y + j), p(r.x + i + 1, r.y + j), p(r.x + i + 1, r.y + j + 1), p(r.x + i, r.y + j + 1)], r.floor[(i + j) % 2]);
      }
    }
    const a = p(r.x, r.y);
    const b = p(r.x + 5, r.y);
    const c = p(r.x, r.y + 4);
    poly([a, b, { x: b.x, y: b.y - 22 }, { x: a.x, y: a.y - 22 }], r.wall);
    poly([a, c, { x: c.x, y: c.y - 22 }, { x: a.x, y: a.y - 22 }], r.wall);
  }
  const desk = (tx, ty, on) => {
    const q = p(tx + 0.5, ty + 0.5);
    ctx.fillStyle = '#8e6040';
    ctx.fillRect(q.x - 7, q.y - 6, 14, 5);
    ctx.fillStyle = on ? '#5ec4b6' : '#2b3550';
    ctx.fillRect(q.x - 4, q.y - 12, 8, 6);
  };
  desk(1, 1, true);
  desk(3, 1, false);
  desk(7, 1, false);
  desk(9, 1, true);

  const walk = (time / 4000) % 1;
  const people = [
    { look: lookOf('sari'), at: p(1.5, 2.3), sitting: true },
    { look: lookOf('ale'), at: p(3.5, 2.3), bubble: ['! Cek', '#f4b942', '#2a1d00'] },
    { look: lookOf('fajar'), at: p(9.5, 2.3), sitting: true },
    { look: lookOf('mira'), at: p(1 + walk * 3, 7), frame: Math.floor(time / 160) },
    { look: lookOf('dimas'), at: p(3.2, 7.4), bubble: ['ngopi', 'rgb(237 240 247 / 0.9)', '#2a3350'] },
  ];
  for (const person of people) {
    drawPerson(ctx, person.at.x, person.at.y + (person.sitting ? Math.floor(time / 450) % 2 : 0), person.look, person);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const person of people) {
    if (person.bubble) pill(ctx, person.bubble[0], person.at.x * k, (person.at.y - 28) * k, person.bubble[1], person.bubble[2]);
  }
}

function placeClip() {
  const clip = hook('clip-range');
  // Real numbers from the Dimas test run: 13.8s to 44.1s of a 98.5s recording.
  clip.style.left = `${(13.8 / 98.5) * 100}%`;
  clip.style.width = `${((44.1 - 13.8) / 98.5) * 100}%`;
}

function setupTheme() {
  const button = document.querySelector('[data-action="toggle-theme"]');
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    button.textContent = theme === 'light' ? 'Ganti ke mode gelap' : 'Ganti ke mode terang';
  };
  let saved = 'dark';
  try {
    saved = localStorage.getItem('kantor-ref-theme') || 'dark';
  } catch {
    saved = 'dark';
  }
  apply(saved);
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    apply(next);
    try {
      localStorage.setItem('kantor-ref-theme', next);
    } catch {
      // Private mode: the theme just won't be remembered.
    }
  });
}

function animate(time) {
  renderPoses(time);
  renderMiniOffice(time);
  requestAnimationFrame(animate);
}

setupTheme();
renderSwatches();
renderContrast();
renderCast();
renderRooms();
placeClip();
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  renderPoses(0);
  renderMiniOffice(0);
} else {
  requestAnimationFrame(animate);
}
