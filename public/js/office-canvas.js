import { createSpriteAtlas } from './sprite-atlas.js';
import { currentPrayer, salatPose } from './prayer-clock.js';
import { TILE, ZK, WALL_FACE, MIMBAR_H, createArt } from './office-art.js';
import { ISO, isoCorner, isoWorldBox } from './iso.js';
import { ROOM_W, ROOM_H, emptySpots, furnishRoom, themeFor } from './office-rooms.js';

// Corridor widths in tiles. Rows need the wider gap: each room's back wall stands up into it.
const GAP_X = 1;
const GAP_Y = 2;
const SPEED = 2.2;
const WUDHU_MS = 2500;
const DEBATE_LINE_MS = 3500;
const MAX_ZOOM = 4;
// Above this the floor cache would get huge on high-DPI screens; it is stretched instead.
const MAX_CACHE_SCALE = 4;

const STATUS_DOT = {
  working: '#2a9d8f',
  queued: '#9ba6c2',
  error: '#ef6f6c',
  chatting: '#9b5de5',
  meeting: '#9b5de5',
};

// States where the agent belongs at their own desk.
const AT_DESK = new Set(['working', 'queued', 'waiting', 'error', 'chatting']);
// States that can step away for salat. Agents mid-task or talking to you stay put.
const CAN_PRAY = new Set(['idle', 'queued', 'waiting', 'error']);
// Idle activities where the agent sits down.
const SEATED = new Set(['rebahan', 'santai', 'berjemur']);

// The owner only shows up on Fridays, as khatib.
const OWNER = { name: 'Kamu', look: { hair: '#1d1d1d', shirt: '#f4f1de', style: 'peci' } };
const KHUTBAH_LINES = [
  'Takwa dulu, deploy kemudian.',
  'Commit sebelum Jumatan!',
  'Kerja ikhlas, deadline tetep jalan.',
  'Jangan ghibahin klien.',
];

// Small talk turned argument, for idle pairs in the lobby. Lines alternate between the two.
const LOBBY_DEBATES = [
  ['Bubur tuh harus diaduk, biar rata.', 'Diaduk malah kayak muntahan kucing.', 'Yang penting rasanya, bukan tampilannya!', 'Makan pakai mata juga, bro.'],
  ['Kerja di kantor bikin fokus.', 'WFH lebih produktif, gak kena macet.', 'Tapi rapat online tuh capek.', 'Ya rapatnya aja dikurangin.'],
  ['Dark mode paling enak di mata.', 'Siang-siang malah silau pantulan.', 'Itu layarmu aja yang kotor.', 'Oke, voting di grup aja.'],
  ['Makan siang nasi padang, gas?', 'Warteg lah, murah dan banyak pilihan.', 'Rendang gak ada lawan.', 'Tanggal tua, bos. Warteg menang.'],
  ['Konten pendek lebih gampang viral.', 'Video panjang bikin orang percaya.', 'Orang scroll dua detik doang.', 'Ya udah, yang panjang dipotong jadi klip.'],
  ['Rapat pagi biar semangat.', 'Pagi itu waktunya ngopi, bukan rapat.', 'Sore udah pada capek.', 'Rapatnya sambil ngopi, deal.'],
];

// Same palette as the app's CSS tokens (canvas can't read custom properties cheaply every frame).
const INK = '#18191d';
const PAPER = '#ece4d4';
const BRASS = '#c98f4e';
const AMBER = '#f5c451';
const PERSON_SCALE = 1.2;
const STAFF_RIM = 'rgb(255 246 228 / 0.8)';
const NAME_FONT = '"Barlow", system-ui, sans-serif';
const LABEL_FONT = '"Barlow Condensed", "Barlow", system-ui, sans-serif';

const isNight = () => {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 6;
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function createOffice(canvas, { onSelect }) {
  const ctx = canvas.getContext('2d');
  document.fonts?.load(`700 14px ${LABEL_FONT}`);
  let rooms = [];
  let items = [];
  let pools = [];
  let people = new Map();
  let spots = emptySpots();
  let blocked = new Set();
  let grid = { w: 0, h: 0 };
  let focusRoom = null;
  let selected = null;
  let origin = { x: 0, y: 0 };
  let world = { w: 0, h: 0 };
  // Screen-space bounds of the iso diamond, filled in by layout(); the camera fits to this.
  let worldBox = { left: 0, top: 0, width: 1, height: 1 };
  let scale = 2;
  let baseScale = 1;
  let offset = { x: 0, y: 0 };
  // Camera: zoom 1 shows the whole office; `center` is the world point in the middle of the canvas.
  const camera = { zoom: 1, center: null, target: null };
  let drag = null;
  let schedule = null;
  // The debate the server says is happening, with its first line pinned to this clock.
  let meeting = null;
  let hitboxes = [];
  let lastTime = 0;
  let running = false;
  let floorCache = null;
  const taken = new Map();

  // Tile grid -> isometric screen px. Everything above this line (sim, pathfinding, depths)
  // stays in tile units; only this mapper knows about the projection.
  const corner = isoCorner(origin);
  const key = (t) => `${t.x},${t.y}`;
  const art = createArt(ctx, corner);
  const spriteAtlas = createSpriteAtlas();

  function layout(divisions, builder, look) {
    const theme = (id) => themeFor(id, look.style);
    const specs = [
      { id: 'lobby', ...theme('lobby'), agents: [builder] },
      ...divisions.map((d) => ({ id: d.id, ...theme(d.id), label: d.room, agents: d.agents })),
      ...look.facilities.map((id) => ({ id, ...theme(id), label: theme(id).label ?? ({ rapat: 'Ruang rapat', pantry: 'Pantry', musala: 'Musala', kolam: 'Kolam' }[id] ?? id), agents: [] })),
    ];
    const columns = bestColumns(specs.length);

    // Corridors run along the top and left too, so every room has walkways on all sides.
    rooms = specs.map((spec, i) => ({
      ...spec,
      x: GAP_X + (i % columns) * (ROOM_W + GAP_X),
      y: GAP_Y + Math.floor(i / columns) * (ROOM_H + GAP_Y),
      w: ROOM_W,
      h: ROOM_H,
    }));

    const rows = Math.ceil(rooms.length / columns);
    grid = { w: GAP_X + columns * (ROOM_W + GAP_X), h: GAP_Y + rows * (ROOM_H + GAP_Y) };
    origin = { x: 4, y: 4 };
    worldBox = isoWorldBox(grid, origin, 8);
    // `world` keeps its old role as a size pair for fit math; in iso it is the bounding box.
    world = { w: worldBox.width, h: worldBox.height };

    items = [];
    pools = [];
    blocked = new Set();
    spots = emptySpots();
    const seats = new Map();
    for (const room of rooms) {
      const furnished = furnishRoom(room, room.agents);
      room.decals = furnished.decals;
      items.push(...furnished.items);
      pools.push(...furnished.pools.map((p) => ({ ...p, room: room.id })));
      furnished.blocked.forEach((t) => blocked.add(t));
      furnished.seats.forEach((seat, id) => seats.set(id, seat));
      for (const [name, list] of Object.entries(furnished.spots)) spots[name].push(...list);
    }

    const next = new Map();
    for (const agent of [builder, ...divisions.flatMap((d) => d.agents)]) {
      const seat = seats.get(agent.id);
      const prev = people.get(agent.id);
      const start = prev?.tile ?? seat;
      next.set(agent.id, {
        ...agent,
        seat,
        tile: start,
        x: prev?.x ?? start.x + 0.5,
        y: prev?.y ?? start.y + 0.5,
        path: [],
        goal: null,
        activity: null,
        decideAt: performance.now() + 1000 + Math.random() * 5000,
        frame: 0,
        back: false,
        status: prev?.status,
      });
    }
    people = next;
    taken.clear();
    floorCache = null;
    resize();
  }

  // The column count that shows the office biggest in the canvas it has right now.
  function bestColumns(count) {
    measureInsets();
    const width = canvas.clientWidth || 1200;
    const height = (canvas.clientHeight || 700) - frameInsets.top - frameInsets.bottom;
    let best = { columns: 3, fit: 0 };
    for (let columns = 2; columns <= Math.min(count, 6); columns++) {
      const rows = Math.ceil(count / columns);
      const g = { w: GAP_X + columns * (ROOM_W + GAP_X), h: GAP_Y + rows * (ROOM_H + GAP_Y) };
      const box = isoWorldBox(g, { x: 4, y: 4 }, 8);
      const fit = Math.min(width / box.width, height / box.height);
      if (fit > best.fit) best = { columns, fit };
    }
    return best.columns;
  }

  const roomOfTile = (t) => rooms.find((r) => t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h) ?? null;

  // Every room is walled on all four sides; the only ways through are its two doors.
  function wallBetween(a, b) {
    const ra = roomOfTile(a);
    const rb = roomOfTile(b);
    if (ra === rb) return false;
    // Rooms never touch, so one side of a crossing is always corridor.
    const room = ra ?? rb;
    const inside = ra ? a : b;
    const outside = ra ? b : a;
    const bottomDoor = inside.x === room.x + room.doors.bottom && inside.y === room.y + room.h - 1 && outside.y === room.y + room.h;
    const rightDoor = inside.y === room.y + room.doors.right && inside.x === room.x + room.w - 1 && outside.x === room.x + room.w;
    return !(bottomDoor || rightDoor);
  }

  function findPath(from, to) {
    const start = key(from);
    const goal = key(to);
    if (start === goal) return [];
    const prev = new Map([[start, null]]);
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      if (key(cur) === goal) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nxt = { x: cur.x + dx, y: cur.y + dy };
        const k = key(nxt);
        if (nxt.x < 0 || nxt.y < 0 || nxt.x >= grid.w || nxt.y >= grid.h) continue;
        if (prev.has(k) || (blocked.has(k) && k !== goal) || wallBetween(cur, nxt)) continue;
        prev.set(k, cur);
        queue.push(nxt);
      }
    }
    if (!prev.has(goal)) return [];
    const path = [];
    for (let t = to; t && key(t) !== start; t = prev.get(key(t))) path.unshift(t);
    return path;
  }

  function goTo(person, tile, activity = null) {
    if (person.goal && key(person.goal) === key(tile)) {
      person.activity = activity;
      return;
    }
    if (person.goal) taken.delete(key(person.goal));
    taken.set(key(tile), person.id);
    person.goal = tile;
    person.activity = activity;
    person.path = findPath(person.tile, tile);
  }

  const free = (list) => list.filter((t) => !taken.has(key(t)));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  let lookKey = '';

  function update(divisions, builder, look = { style: 'modern', facilities: ['rapat', 'pantry', 'musala', 'kolam'] }) {
    const everyone = [builder, ...divisions.flatMap((d) => d.agents)];
    const nextKey = JSON.stringify([divisions.map((d) => d.id), look.style, look.facilities]);
    const changed = everyone.length !== people.size || everyone.some((a) => !people.has(a.id)) || nextKey !== lookKey;
    lookKey = nextKey;
    if (changed) layout(divisions, builder, look);
    for (const agent of everyone) people.get(agent.id).status = agent.status;
  }

  function decideIdle(person, now) {
    const roll = Math.random();
    person.decideAt = now + 8000 + Math.random() * 9000;
    const options = [
      [0.2, null, () => person.seat],
      [0.36, 'ngopi', () => pick(free(spots.coffee))],
      [0.46, 'rebahan', () => pick(free(spots.sofa))],
      [0.54, 'santai', () => pick(free(spots.chill))],
      [0.64, 'berjemur', () => pick(free(spots.lounger))],
      [0.72, 'berenang', () => pick(free(spots.swim))],
    ];
    const choice = options.find(([limit]) => roll < limit);
    const tile = choice?.[2]();
    if (tile) return goTo(person, tile, choice[1]);

    const partner = [...people.values()].find((p) => p !== person && (p.status?.state ?? 'idle') === 'idle' && !p.partner);
    if (roll < 0.84 && partner && startDebate(person, partner, now)) return undefined;
    const chatSpots = free(spots.chat);
    if (partner && chatSpots.length >= 2) {
      goTo(person, chatSpots[0], 'ngobrol');
      goTo(partner, chatSpots[1], 'ngobrol');
      person.partner = partner.id;
      partner.partner = person.id;
      partner.decideAt = person.decideAt;
      return undefined;
    }
    return goTo(person, person.seat, null);
  }

  // Two idle agents walk to the lobby and argue about something that doesn't matter.
  function startDebate(person, partner, now) {
    const places = free(spots.debate);
    if (places.length < 2) return false;
    const lines = pick(LOBBY_DEBATES);
    const startAt = now + 5000;
    goTo(person, places[0], 'debat');
    goTo(partner, places[1], 'debat');
    person.partner = partner.id;
    partner.partner = person.id;
    person.debate = { lines, startAt, side: 0 };
    partner.debate = { lines, startAt, side: 1 };
    person.decideAt = startAt + lines.length * DEBATE_LINE_MS + 1500;
    partner.decideAt = person.decideAt;
    return true;
  }

  function unpair(person) {
    if (!person.partner) return;
    const partner = people.get(person.partner);
    if (partner) partner.partner = null;
    person.partner = null;
  }

  // Wudhu at one of the taps first, then take a place: imam spot or the next one in the rows.
  function joinPrayer(person, prayer, index, now) {
    unpair(person);
    if (person.wudhuFor !== prayer.at) {
      goTo(person, spots.wudhu[index % spots.wudhu.length], 'wudhu');
      if (!person.path.length && now - person.arrivedAt > WUDHU_MS) person.wudhuFor = prayer.at;
      return undefined;
    }
    // On Friday the owner leads; other days the first agent in line does.
    if (!prayer.jumatan && index === 0) return goTo(person, spots.imam[0], 'imam');
    const place = prayer.jumatan ? index : index - 1;
    return goTo(person, spots.saf[place % spots.saf.length], 'salat');
  }

  function plan(now, prayer) {
    let meetingIndex = 0;
    let prayerIndex = 0;
    for (const person of people.values()) {
      const state = person.status?.state ?? 'idle';
      if (state !== 'idle') person.partner = null;

      if (prayer && CAN_PRAY.has(state) && spots.saf.length) {
        joinPrayer(person, prayer, prayerIndex++, now);
        continue;
      }
      // Salat is over: pick something else to do straight away.
      if (['wudhu', 'salat', 'imam'].includes(person.activity)) person.decideAt = 0;

      if (state === 'meeting') {
        // No meeting room: they stand together in the lobby instead.
        const table = spots.meeting.length ? spots.meeting : spots.debate;
        goTo(person, table[meetingIndex++ % table.length] ?? person.seat, null);
      } else if (AT_DESK.has(state)) {
        goTo(person, person.seat, null);
      } else if (now > person.decideAt || !person.goal) {
        unpair(person);
        decideIdle(person, now);
      }
    }
  }

  function step(dt, now, prayer) {
    plan(now, prayer);
    for (const person of people.values()) {
      const target = person.path[0];
      if (!target) continue;
      const tx = target.x + 0.5;
      const ty = target.y + 0.5;
      const dx = tx - person.x;
      const dy = ty - person.y;
      const dist = Math.hypot(dx, dy);
      const move = SPEED * dt;
      // Walking up the screen means walking away from the viewer.
      if (Math.abs(dy) > 0.01) person.back = dy < 0;
      if (dist <= move) {
        person.x = tx;
        person.y = ty;
        person.tile = target;
        person.path.shift();
        if (!person.path.length) person.arrivedAt = now;
      } else {
        person.x += (dx / dist) * move;
        person.y += (dy / dist) * move;
      }
      person.frame = Math.floor(now / 160);
    }
  }

  // On wide screens the toolbars float over the canvas, so the office is framed between them
  // instead of hiding its top row of room names under the chips.
  let frameInsets = { top: 0, bottom: 0 };
  function measureInsets() {
    const floating = (selector) => {
      const el = canvas.parentElement?.querySelector(selector);
      return el && getComputedStyle(el).position === 'absolute' ? el.getBoundingClientRect().height + 12 : 0;
    };
    frameInsets = { top: floating('.office__hud--top'), bottom: floating('.office__hud--bottom') };
  }

  const view = () => {
    const height = canvas.clientHeight - frameInsets.top - frameInsets.bottom;
    return { width: canvas.clientWidth, height, cx: canvas.clientWidth / 2, cy: frameInsets.top + height / 2 };
  };

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    measureInsets();
    const dpr = window.devicePixelRatio || 1;
    baseScale = Math.min(width / world.w, view().height / world.h);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    floorCache = null;
    applyCamera();
  }

  function applyCamera() {
    const { width, height, cx, cy } = view();
    camera.center ??= { x: worldBox.left + worldBox.width / 2, y: worldBox.top + worldBox.height / 2 };
    scale = baseScale * camera.zoom;
    // Device-pixel snapping keeps upscaled pixels crisp instead of straddling two device px.
    const dpr = window.devicePixelRatio || 1;
    const snap = (value) => Math.round(value * scale * dpr) / (scale * dpr);
    const keep = (value, lo, hi, span) => {
      const half = span / 2 / scale;
      const size = hi - lo;
      return size <= half * 2 ? lo + size / 2 : Math.min(hi - half, Math.max(lo + half, value));
    };
    camera.center.x = keep(camera.center.x, worldBox.left, worldBox.left + worldBox.width, width);
    camera.center.y = keep(camera.center.y, worldBox.top, worldBox.top + worldBox.height, height);
    offset = { x: snap(cx - camera.center.x * scale), y: snap(cy - camera.center.y * scale) };
    canvas.style.cursor = drag?.moved ? 'grabbing' : camera.zoom > 1 ? 'grab' : 'pointer';
    canvas.style.touchAction = camera.zoom > 1 ? 'none' : 'pan-y';
  }

  function setCamera(zoom, center, { animate = false } = {}) {
    const next = { zoom: Math.min(MAX_ZOOM, Math.max(1, zoom)), center: { ...center } };
    if (animate && !prefersReducedMotion()) {
      camera.target = next;
      return;
    }
    camera.target = null;
    camera.zoom = next.zoom;
    camera.center = next.center;
    floorCache = null;
    applyCamera();
  }

  // The center that keeps `anchor` (a world point) under screen point (px, py) at this zoom.
  const centerFor = (anchor, zoom) => ({
    x: anchor.x - (anchor.px - view().cx) / (baseScale * zoom),
    y: anchor.y - (anchor.py - view().cy) / (baseScale * zoom),
  });

  // Eases the camera towards its target: a room picked from the chips, or a wheel zoom that
  // keeps the point under the cursor where it is the whole way.
  function stepCamera() {
    const t = camera.target;
    if (!t) return;
    if (!t.anchor) {
      camera.zoom += (t.zoom - camera.zoom) * 0.18;
      camera.center.x += (t.center.x - camera.center.x) * 0.18;
      camera.center.y += (t.center.y - camera.center.y) * 0.18;
      if (Math.abs(t.zoom - camera.zoom) < 0.005 && Math.hypot(t.center.x - camera.center.x, t.center.y - camera.center.y) < 0.5) {
        camera.zoom = t.zoom;
        camera.center = { ...t.center };
        camera.target = null;
        floorCache = null;
      }
      applyCamera();
      return;
    }
    const previousZoom = camera.zoom;
    camera.zoom += (t.zoom - camera.zoom) * 0.3;
    if (Math.abs(t.zoom - camera.zoom) < 0.002) {
      camera.zoom = t.zoom;
      camera.target = null;
    }
    if (Math.abs(previousZoom - camera.zoom) > 0.08 || !camera.target) floorCache = null;
    camera.center = centerFor(t.anchor, camera.zoom);
    applyCamera();
  }

  // Wheel steps ease in; pinches follow the fingers directly. Quick wheel turns stack onto a
  // zoom that is still easing, so three notches really mean three notches.
  function zoomAt(factor, px, py, { smooth = true } = {}) {
    const from = camera.target?.anchor ? camera.target.zoom : camera.zoom;
    const zoom = Math.min(MAX_ZOOM, Math.max(1, from * factor));
    const anchor = { x: (px - offset.x) / scale, y: (py - offset.y) / scale, px, py };
    if (smooth && !prefersReducedMotion()) {
      camera.target = { zoom, anchor };
      return;
    }
    camera.target = null;
    camera.zoom = zoom;
    camera.center = centerFor(anchor, zoom);
    floorCache = null;
    applyCamera();
  }

  function pan(dx, dy) {
    camera.target = null;
    camera.center = { x: camera.center.x + dx / scale, y: camera.center.y + dy / scale };
    applyCamera();
  }

  // Screen rect covering a room's floor diamond and the standing back wall above it.
  // The lit area of a room: its floor diamond plus the wall slab standing on the two far
  // edges. Traced as one polygon so night mode can cut it out with evenodd and fill it warm.
  function isoRoomPolygon(room) {
    const n = corner(room.x, room.y);
    const e = corner(room.x + room.w, room.y);
    const s = corner(room.x + room.w, room.y + room.h);
    const w = corner(room.x, room.y + room.h);
    const lift = WALL_FACE * ZK * 1.5;
    return [
      { x: w.x, y: w.y }, { x: n.x, y: n.y - lift }, { x: e.x, y: e.y - lift },
      { x: s.x, y: s.y },
    ];
  }

  function traceIsoRoom(ctx, room) {
    const pts = isoRoomPolygon(room);
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  }

  function roomView(roomId) {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return { zoom: 1, center: { x: worldBox.left + worldBox.width / 2, y: worldBox.top + worldBox.height / 2 } };
    const points = [corner(room.x, room.y), corner(room.x + room.w, room.y), corner(room.x + room.w, room.y + room.h), corner(room.x, room.y + room.h)];
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y)) - WALL_FACE - 20;
    const maxY = Math.max(...points.map((p) => p.y)) + 8;
    const zoom = 0.92 * Math.min(view().width / ((maxX - minX) * baseScale), view().height / ((maxY - minY) * baseScale));
    return { zoom: Math.min(MAX_ZOOM, Math.max(1, zoom)), center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } };
  }

  const dim = (roomId) => (!focusRoom || focusRoom === roomId ? 1 : 0.3);

  function worldTransform(target) {
    const dpr = window.devicePixelRatio || 1;
    target.setTransform(scale * dpr, 0, 0, scale * dpr, offset.x * dpr, offset.y * dpr);
  }

  // Floors, rugs and furniture shadows never change between frames, so they are drawn once
  // in world space and only redrawn when the zoom level changes.
  function buildFloorCache(cacheScale) {
    const layer = document.createElement('canvas');
    layer.width = Math.ceil(worldBox.width * cacheScale);
    layer.height = Math.ceil(worldBox.height * cacheScale);
    const lctx = layer.getContext('2d');
    const floorArt = createArt(lctx, corner);
    // Cache space puts the world's left/top corner at (0, 0).
    lctx.setTransform(cacheScale, 0, 0, cacheScale, -worldBox.left * cacheScale, -worldBox.top * cacheScale);

    lctx.globalAlpha = focusRoom ? 0.3 : 1;
    for (let tx = 0; tx < grid.w; tx++) {
      for (let ty = 0; ty < grid.h; ty++) floorArt.floorTile('corridor', tx, ty);
    }
    for (const room of rooms) {
      lctx.globalAlpha = dim(room.id);
      for (let tx = 0; tx < room.w; tx++) {
        for (let ty = 0; ty < room.h; ty++) floorArt.floorTile(room.floor, room.x + tx, room.y + ty);
      }
    }
    for (const it of items) {
      lctx.globalAlpha = dim(it.room);
      if (it.shadow !== false && it.type !== 'chandelier') floorArt.floorDetail(it);
    }
    // Side and front partitions are low and never change, so they live here too.
    for (const room of rooms) {
      lctx.globalAlpha = dim(room.id);
      floorArt.partitions(room);
    }
    floorCache = { canvas: layer, scale: cacheScale, builtAt: performance.now() };
  }

  function personPose(person, prayer, settled) {
    const state = person.status?.state ?? 'idle';
    const praying = Boolean(prayer) && settled && (person.activity === 'salat' || person.activity === 'imam');
    if (praying) {
      const pose = prayer.phase === 'salat' ? salatPose(prayer) : prayer.phase === 'khutbah' ? 'sit' : 'stand';
      return { pose, back: true, praying };
    }
    // At their desk they face the monitors, away from the viewer.
    const atSeat = settled && person.goal === person.seat && (AT_DESK.has(state) || !person.activity);
    if (atSeat) return { pose: 'sit', back: true, praying };
    if (settled && person.activity === 'berenang') return { pose: 'swim', back: false, praying };
    if (settled && (state === 'meeting' || SEATED.has(person.activity))) return { pose: 'sit', back: false, praying };
    return { pose: 'stand', back: settled ? false : person.back, praying };
  }

  function draw(now, prayer) {
    // The loop starts before the first /api/office answer; there is nothing to draw yet.
    if (!world.w || !canvas.width) return;
    const dpr = window.devicePixelRatio || 1;
    const night = isNight();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // While zooming, stretch the old cache and rebuild it at most every 150 ms.
    const wanted = Math.min(MAX_CACHE_SCALE, scale * dpr);
    if (!floorCache || (floorCache.scale !== wanted && now - floorCache.builtAt > 150)) buildFloorCache(wanted);
    ctx.imageSmoothingEnabled = floorCache.scale !== wanted;
    // The cache holds the world starting at worldBox.left/top; map that corner into place.
    ctx.drawImage(floorCache.canvas,
      (offset.x + worldBox.left * (1 - scale)) * dpr,
      (offset.y + worldBox.top * (1 - scale)) * dpr,
      worldBox.width * scale * dpr, worldBox.height * scale * dpr);

    worldTransform(ctx);
    ctx.imageSmoothingEnabled = false;

    for (const it of pools) {
      ctx.globalAlpha = dim(it.room);
      art.pool(it, now);
    }

    // Everything with height goes through one sort, back to front: walls, furniture, people.
    const drawables = [];
    for (const room of rooms) {
      drawables.push({ depth: room.y - 0.01, room: room.id, draw: () => art.backWall(room, night, now) });
    }
    const busyRooms = new Set([...people.values()]
      .filter((p) => p.status?.state === 'working' && p.seat)
      .map((p) => roomAt(p.seat.x, p.seat.y)));
    for (const it of items) {
      if (it.type === 'rug') continue;
      const busy = it.owner ? people.get(it.owner)?.status?.state === 'working' : busyRooms.has(it.room);
      const depth = it.y + (it.d ?? 1) - 0.05;
      drawables.push({ depth, room: it.room, draw: () => art.item(it, { busy, night, now }) });
    }
    for (const person of people.values()) {
      drawables.push({ depth: person.y + 0.05, room: roomAt(person.x, person.y), person });
    }
    const khatib = prayer?.jumatan ? khatibSpot(prayer) : null;
    if (khatib) {
      drawables.push({ depth: khatib.y + 0.7, room: 'musala', draw: () => drawKhatib(khatib, prayer) });
    }
    drawables.sort((a, b) => a.depth - b.depth);

    hitboxes = [];
    for (const entry of drawables) {
      ctx.globalAlpha = dim(entry.room);
      if (entry.draw) {
        entry.draw();
        continue;
      }
      const { person } = entry;
      const p = corner(person.x, person.y);
      const settled = !person.path.length;
      const { pose, back, praying } = personPose(person, prayer, settled);
      const bob = person.status?.state === 'working' && pose === 'sit' ? Math.round(Math.sin(now / 180)) : 0;
      const sink = pose === 'swim' ? 4 : 0;
      if (person.status?.state === 'waiting' || person.status?.state === 'error') {
        const color = person.status.state === 'waiting' ? AMBER : '#ef6f6c';
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 27), 5, 5);
      }
      drawStaff(p.x, p.y + bob + sink, person.look, { frame: settled ? 0 : person.frame, pose, back });
      // hitbox y uses person height at base scale (16*PERSON_SCALE)
      hitboxes.push({ id: person.id, x: p.x, y: p.y - 14 * PERSON_SCALE, alpha: ctx.globalAlpha, settled, praying });
    }
    ctx.globalAlpha = 1;

    if (night) drawNight();
    drawLabels(now, prayer, khatib);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Night: the corridors go dark while every room keeps its ceiling lights on, evenly. Glow
  // blobs over whole rooms washed the pixel art out and left unlit rooms looking dead.
  function drawNight() {
    const full = [-offset.x / scale, -offset.y / scale, canvas.width / scale, canvas.height / scale];
    // Each room lights up as its floor diamond plus the wall slab standing on the far edges.
    ctx.beginPath();
    ctx.rect(...full);
    for (const room of rooms) traceIsoRoom(ctx, room);
    ctx.fillStyle = 'rgb(8 10 28 / 0.45)';
    ctx.fill('evenodd');
    ctx.save();
    ctx.beginPath();
    for (const room of rooms) traceIsoRoom(ctx, room);
    ctx.clip();
    ctx.fillStyle = 'rgb(255 214 150 / 0.05)';
    ctx.fillRect(...full);
    ctx.restore();

    // Lamps and busy screens: a small, tight pool of light, not a haze across the room.
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, z, radius, color) => {
      const p = art.at(x, y, z);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgb(0 0 0 / 0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
    };
    for (const it of items) {
      if (it.type === 'lamp') glow(it.x + 0.5, it.y + 0.5, 26, 16, 'rgb(255 205 120 / 0.28)');
      if (it.type === 'desk' && people.get(it.owner)?.status?.state === 'working') {
        glow(it.x + 0.4, it.y + 0.2, 20, 12, 'rgb(90 220 200 / 0.25)');
      }
    }
    // Someone crossing a dark corridor still needs to be seen.
    for (const person of people.values()) {
      if (!roomAt(person.x, person.y)) glow(person.x, person.y, 24, 14, 'rgb(255 236 205 / 0.2)');
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Staff are drawn a touch larger than the furniture scale suggests and with a light rim,
  // so they stay readable on dark wood and marble, the way pixel games outline their characters.
  function drawStaff(x, y, look, options) {
    // x, y are screen px where feet land (bottom-center)
    spriteAtlas.draw(ctx, x, y, look, { ...options, rim: STAFF_RIM });
  }

  // Where the Friday khatib stands: on the mimbar for the khutbah, then at the front as imam.
  function khatibSpot(prayer) {
    const spot = prayer.phase === 'salat' ? spots.imam[0] : spots.mimbar[0];
    return spot ? { x: spot.x + 0.5, y: spot.y + 0.5, raised: prayer.phase !== 'salat' } : null;
  }

  function drawKhatib(spot, prayer) {
    const p = corner(spot.x, spot.y);
    const pose = prayer.phase === 'salat' ? salatPose(prayer) : 'stand';
    drawStaff(p.x, p.y - (spot.raised ? MIMBAR_H * ZK : 0), OWNER.look, { pose, back: prayer.phase === 'salat' });
  }

  function drawLabels(now, prayer, khatib) {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const room of rooms) {
      // The nameplate floats over the wall side of the room's diamond.
      const p = corner(room.x + room.w / 2, room.y - 0.5);
      const lift = (room.walls === 'railing' ? 10 * ZK : WALL_FACE) + 12;
      const x = offset.x + p.x * scale;
      const y = offset.y + (p.y - lift) * scale;
      ctx.save();
      ctx.globalAlpha = dim(room.id);
      ctx.font = `700 13px ${LABEL_FONT}`;
      plate(room.label.toUpperCase(), x, y);
      ctx.restore();
    }

    const compact = scale < 0.6;
    for (const hit of hitboxes) {
      const person = people.get(hit.id);
      if (!person) continue;
      const x = offset.x + hit.x * scale;
      const y = offset.y + hit.y * scale;
      const state = person.status?.state ?? 'idle';
      if (compact) {
        if (state === 'waiting' || state === 'error') pill('!', x, y - 14, state === 'waiting' ? AMBER : '#ef6f6c', INK);
        continue;
      }
      if (hit.praying && hit.id !== selected) continue;
      ctx.save();
      ctx.globalAlpha = hit.alpha;
      const namePx = 12;
      ctx.font = `700 ${namePx}px ${NAME_FONT}`;
      ctx.fillStyle = hit.id === selected ? AMBER : '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeText(person.name, x, y + 22 * scale);
      ctx.fillText(person.name, x, y + 22 * scale);
      const said = hit.settled ? speech(person, now) : null;
      const activity = person.activity && hit.settled && !['salat', 'imam', 'debat'].includes(person.activity)
        ? (person.activity === 'ngobrol' ? '…' : person.activity) : null;
      const text = said || (state !== 'idle' && state !== 'working' ? person.status?.text : null) || activity;
      if (text) {
        ctx.font = `600 ${Math.max(9, namePx - 1)}px ${NAME_FONT}`;
        pill(truncate(text, 24), x, y - 14 * scale, state === 'waiting' ? AMBER : PAPER, INK);
      }
      ctx.restore();
    }

    if (khatib) {
      const p = corner(khatib.x, khatib.y);
      ctx.font = `700 10px ${NAME_FONT}`;
      ctx.fillStyle = AMBER;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.strokeText('Kamu · khatib', offset.x + p.x * scale, offset.y + (p.y + 22) * scale);
      ctx.fillText('Kamu · khatib', offset.x + p.x * scale, offset.y + (p.y + 22) * scale);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * What this person is saying right now in a debate: a line, '' while it's someone else's
   * turn, or null when they aren't debating (so the usual status card shows).
   */
  function speech(person, now) {
    const state = person.status?.state ?? 'idle';
    if (state === 'meeting' && meeting?.agents.includes(person.id)) {
      const turn = meeting.agents.indexOf(person.id);
      if (meeting.startAt == null) return Math.floor(now / 1800) % meeting.agents.length === turn ? '…' : '';
      const line = meeting.lines[Math.floor((now - meeting.startAt) / meeting.lineMs)];
      return line?.agent === person.id ? line.text : '';
    }
    if (state === 'idle' && person.activity === 'debat' && person.debate) {
      const i = Math.floor((now - person.debate.startAt) / DEBATE_LINE_MS);
      return i >= 0 && i % 2 === person.debate.side ? person.debate.lines[i] ?? '' : '';
    }
    return null;
  }

  const fontPx = () => Number(ctx.font.match(/(\d+)px/)[1]);

  function wrap(text, maxWidth) {
    const lines = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Speech bubble with a tail pointing at the speaker; the tail's tip sits at y.
  function bubble(text, x, y, edge) {
    const size = fontPx();
    let lines = wrap(text, size * 15);
    if (lines.length > 4) lines = [...lines.slice(0, 3), `${lines[3]}…`];
    const lineH = size + 4;
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
    const h = lines.length * lineH + 10;
    const top = y - h - 6;
    ctx.fillStyle = 'rgb(24 25 29 / 0.3)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + 1, top + 2, w, h, 3);
    ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, top, w, h, 3);
    ctx.moveTo(x - 6, top + h);
    ctx.lineTo(x, top + h + 6);
    ctx.lineTo(x + 6, top + h);
    ctx.fill();
    if (edge) {
      ctx.fillStyle = edge;
      ctx.fillRect(x - w / 2 + 6, top, w - 12, 2);
    }
    ctx.fillStyle = INK;
    lines.forEach((l, i) => ctx.fillText(l, x, top + 5 + lineH * (i + 0.5)));
  }

  // Rounded label sized from the current font, so it grows with the office.
  function pill(text, x, y, bg, fg) {
    const w = ctx.measureText(text).width + 12;
    const h = fontPx() + 7;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y + 0.5);
  }

  // Room name plate: dark slab with a brass edge, like a door sign.
  function plate(text, x, y) {
    const w = ctx.measureText(text).width + 22;
    const h = fontPx() + 9;
    const left = x - w / 2;
    ctx.fillStyle = 'rgb(24 25 29 / 0.9)';
    ctx.beginPath();
    ctx.moveTo(left, y - h / 2);
    ctx.lineTo(left + w, y - h / 2);
    ctx.lineTo(left + w, y + h / 2 - 5);
    ctx.lineTo(left + w - 5, y + h / 2);
    ctx.lineTo(left, y + h / 2);
    ctx.fill();
    ctx.fillStyle = BRASS;
    ctx.fillRect(left, y - h / 2, 3, h);
    ctx.fillStyle = PAPER;
    ctx.fillText(text, x + 2, y + 1);
  }

  // Light card with a coloured state bar, for what an agent is working on.
  function tag(text, x, y, dot) {
    const size = fontPx();
    const w = ctx.measureText(text).width + 18;
    const h = size + 9;
    const left = x - w / 2;
    ctx.fillStyle = 'rgb(24 25 29 / 0.3)';
    ctx.fillRect(left + 1, y - h / 2 + 2, w, h);
    ctx.fillStyle = PAPER;
    ctx.fillRect(left, y - h / 2, w, h);
    ctx.fillStyle = dot;
    ctx.fillRect(left, y - h / 2, 4, h);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(text, left + 10, y + 0.5);
    ctx.textAlign = 'center';
  }

  function roomAt(x, y) {
    return rooms.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)?.id ?? null;
  }

  function frame(time) {
    if (!running) return;
    const dt = Math.min(0.1, (time - lastTime) / 1000 || 0);
    lastTime = time;
    stepCamera();
    const prayer = currentPrayer(schedule);
    step(dt, time, prayer);
    draw(time, prayer);
    requestAnimationFrame(frame);
  }

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
    const delta = event.deltaY * unit;
    const step = event.ctrlKey || Math.abs(delta) < 45 ? 1.25 : 1.5;
    const rect = canvas.getBoundingClientRect();
    zoomAt(delta < 0 ? step : 1 / step, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  // Touch and pen can put two pointers down; mouse never does.
  const pointers = new Map();
  let pinch = null;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      pinch = spread();
      if (drag) drag.moved = true;
      return;
    }
    drag = { x: event.clientX, y: event.clientY, moved: false };
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && pointers.size === 2) {
      const now = spread();
      const rect = canvas.getBoundingClientRect();
      zoomAt(now.dist / pinch.dist, now.x - rect.left, now.y - rect.top, { smooth: false });
      pan(pinch.x - now.x, pinch.y - now.y);
      pinch = now;
      return;
    }
    if (!drag || camera.zoom <= 1) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    canvas.setPointerCapture(event.pointerId);
    pan(-dx, -dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
  });

  const release = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size) return;
    // Let the click that follows a drag know it was a drag, then forget it.
    setTimeout(() => {
      drag = null;
      applyCamera();
    });
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('dblclick', () => setCamera(1, { x: worldBox.left + worldBox.width / 2, y: worldBox.top + worldBox.height / 2 }, { animate: true }));

  canvas.addEventListener('click', (event) => {
    if (drag?.moved) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - offset.x) / scale;
    const y = (event.clientY - rect.top - offset.y) / scale;
    let best = null;
    let bestDist = 18;
    for (const hit of hitboxes) {
      const dist = Math.hypot(hit.x - x, hit.y - y);
      if (dist < bestDist) {
        best = hit;
        bestDist = dist;
      }
    }
    if (best) {
      selected = best.id;
      onSelect(best.id);
    }
  });

  // Catches fullscreen and the side panel opening too, not just window resizes.
  new ResizeObserver(() => {
    if (rooms.length) resize();
  }).observe(canvas);

  return {
    update,
    setPrayer(next) {
      schedule = next;
    },
    // The server sends its own clock with the meeting, so the lines play right even if this one is off.
    setMeeting(next) {
      if (!next) {
        meeting = null;
        return;
      }
      if (meeting?.id === next.id && (meeting.startAt != null || next.playedAt == null)) return;
      const startAt = next.playedAt == null ? null : performance.now() + (next.playedAt - next.now);
      meeting = { ...next, startAt };
    },
    rooms: () => rooms.map(({ id, label }) => ({ id, label })),
    focus(roomId) {
      focusRoom = roomId;
      floorCache = null;
      const view = roomView(roomId);
      setCamera(view.zoom, view.center, { animate: true });
    },
    zoomBy(factor) {
      zoomAt(factor, view().cx, view().cy);
    },
    select(id) {
      selected = id;
    },
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      if (rooms.length) resize();
      requestAnimationFrame(frame);
    },
    stop() {
      running = false;
    },
  };
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
