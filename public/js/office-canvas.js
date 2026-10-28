import { drawPerson } from './sprites.js';
import { currentPrayer, salatPose } from './prayer-clock.js';
import { TW, TH, WALL, MIMBAR_H, createArt } from './office-art.js';
import { ROOM_W, ROOM_H, emptySpots, furnishRoom, themeFor } from './office-rooms.js';

const GAP = 1;
const SPEED = 2.2;
const WUDHU_MS = 2500;
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

const isNight = () => {
  const hour = new Date().getHours();
  return hour >= 19 || hour < 6;
};

export function createOffice(canvas, { onSelect }) {
  const ctx = canvas.getContext('2d');
  // Silkscreen is only used on the canvas here, and canvas text never triggers a webfont download.
  document.fonts?.load('11px Silkscreen');
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
  let scale = 2;
  let baseScale = 1;
  let offset = { x: 0, y: 0 };
  // Camera: zoom 1 shows the whole office; `center` is the world point in the middle of the canvas.
  const camera = { zoom: 1, center: null, target: null };
  let drag = null;
  let schedule = null;
  let hitboxes = [];
  let lastTime = 0;
  let running = false;
  let floorCache = null;
  const taken = new Map();

  const corner = (tx, ty) => ({
    x: (tx - ty) * (TW / 2) + origin.x,
    y: (tx + ty) * (TH / 2) + origin.y,
  });
  const key = (t) => `${t.x},${t.y}`;
  const art = createArt(ctx, corner);

  function layout(divisions, builder, look) {
    const theme = (id) => themeFor(id, look.style);
    const specs = [
      { id: 'lobby', ...theme('lobby'), agents: [builder] },
      ...divisions.map((d) => ({ id: d.id, ...theme(d.id), label: d.room, agents: d.agents })),
      ...look.facilities.map((id) => ({ id, ...theme(id), agents: [] })),
    ];
    const columns = specs.length > 9 ? 4 : 3;

    rooms = specs.map((spec, i) => ({
      ...spec,
      x: (i % columns) * (ROOM_W + GAP),
      y: Math.floor(i / columns) * (ROOM_H + GAP),
      w: ROOM_W,
      h: ROOM_H,
    }));

    const rows = Math.ceil(rooms.length / columns);
    grid = { w: columns * (ROOM_W + GAP), h: rows * (ROOM_H + GAP) };
    world = { w: (grid.w + grid.h) * (TW / 2) + 8, h: (grid.w + grid.h) * (TH / 2) + WALL + 24 };
    origin = { x: grid.h * (TW / 2) + 4, y: WALL + 16 };

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

  // Walls are on each room's back (top and left) edges; crossing them is only allowed at the door.
  function wallBetween(a, b) {
    for (const room of rooms) {
      if (a.x === b.x && a.x >= room.x && a.x < room.x + room.w) {
        const crossesTop = (a.y === room.y - 1 && b.y === room.y) || (b.y === room.y - 1 && a.y === room.y);
        if (crossesTop && a.x !== room.x + room.doors.top) return true;
      }
      if (a.y === b.y && a.y >= room.y && a.y < room.y + room.h) {
        const crossesLeft = (a.x === room.x - 1 && b.x === room.x) || (b.x === room.x - 1 && a.x === room.x);
        if (crossesLeft && a.y !== room.y + room.doors.left) return true;
      }
    }
    return false;
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
        goTo(person, spots.meeting[meetingIndex++ % spots.meeting.length] ?? person.seat, null);
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
      // Walking "up" the screen means walking away from the viewer.
      person.back = dx + dy < 0;
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

  // The canvas fills its box; at zoom 1 the whole office fits inside it, centered.
  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height || !world.w) return;
    const dpr = window.devicePixelRatio || 1;
    baseScale = Math.min(width / world.w, height / world.h);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    applyCamera();
  }

  function applyCamera() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.center ??= { x: world.w / 2, y: world.h / 2 };
    camera.center.x = Math.min(world.w, Math.max(0, camera.center.x));
    camera.center.y = Math.min(world.h, Math.max(0, camera.center.y));
    scale = baseScale * camera.zoom;
    offset = { x: width / 2 - camera.center.x * scale, y: height / 2 - camera.center.y * scale };
  }

  function setCamera(zoom, center, { animate = false } = {}) {
    const next = { zoom: Math.min(MAX_ZOOM, Math.max(1, zoom)), center: { ...center } };
    if (animate) {
      camera.target = next;
      return;
    }
    camera.target = null;
    camera.zoom = next.zoom;
    camera.center = next.center;
    applyCamera();
  }

  // Eases the camera towards a room picked from the chips.
  function stepCamera() {
    const t = camera.target;
    if (!t) return;
    camera.zoom += (t.zoom - camera.zoom) * 0.18;
    camera.center.x += (t.center.x - camera.center.x) * 0.18;
    camera.center.y += (t.center.y - camera.center.y) * 0.18;
    if (Math.abs(t.zoom - camera.zoom) < 0.005 && Math.hypot(t.center.x - camera.center.x, t.center.y - camera.center.y) < 0.5) {
      camera.zoom = t.zoom;
      camera.center = { ...t.center };
      camera.target = null;
    }
    applyCamera();
  }

  function zoomAt(factor, px, py) {
    const point = { x: (px - offset.x) / scale, y: (py - offset.y) / scale };
    const zoom = Math.min(MAX_ZOOM, Math.max(1, camera.zoom * factor));
    const next = baseScale * zoom;
    setCamera(zoom, {
      x: point.x - (px - canvas.clientWidth / 2) / next,
      y: point.y - (py - canvas.clientHeight / 2) / next,
    });
  }

  function roomView(roomId) {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return { zoom: 1, center: { x: world.w / 2, y: world.h / 2 } };
    const points = [corner(room.x, room.y), corner(room.x + room.w, room.y), corner(room.x + room.w, room.y + room.h), corner(room.x, room.y + room.h)];
    const minX = Math.min(...points.map((p) => p.x));
    const maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y)) - WALL - 20;
    const maxY = Math.max(...points.map((p) => p.y)) + 8;
    const zoom = 0.9 * Math.min(canvas.clientWidth / ((maxX - minX) * baseScale), canvas.clientHeight / ((maxY - minY) * baseScale));
    return { zoom, center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } };
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
    layer.width = Math.ceil(world.w * cacheScale);
    layer.height = Math.ceil(world.h * cacheScale);
    const lctx = layer.getContext('2d');
    const floorArt = createArt(lctx, corner);
    lctx.setTransform(cacheScale, 0, 0, cacheScale, 0, 0);

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
    floorCache = { canvas: layer, scale: cacheScale, builtAt: performance.now() };
  }

  function wallSegments(room) {
    const segments = [];
    for (let i = 0; i < room.w; i++) {
      segments.push({ depth: room.x + i + 0.5 + room.y, x0: room.x + i, y0: room.y, x1: room.x + i + 1, y1: room.y, bx: 0, by: -0.12, isTop: true, index: i });
    }
    for (let i = 0; i < room.h; i++) {
      segments.push({ depth: room.x + room.y + i + 0.5, x0: room.x, y0: room.y + i, x1: room.x, y1: room.y + i + 1, bx: -0.12, by: 0, isTop: false, index: i });
    }
    return segments;
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
    ctx.drawImage(floorCache.canvas, offset.x * dpr, offset.y * dpr, world.w * scale * dpr, world.h * scale * dpr);

    worldTransform(ctx);
    ctx.imageSmoothingEnabled = false;

    for (const it of pools) {
      ctx.globalAlpha = dim(it.room);
      art.pool(it, now);
    }

    // Everything with height goes through one depth sort: wall tiles, furniture, people.
    const drawables = [];
    for (const room of rooms) {
      for (const segment of wallSegments(room)) {
        drawables.push({ depth: segment.depth, room: room.id, draw: () => art.wall(room, segment, night, now) });
      }
    }
    const busyRooms = new Set([...people.values()]
      .filter((p) => p.status?.state === 'working' && p.seat)
      .map((p) => roomAt(p.seat.x, p.seat.y)));
    for (const it of items) {
      if (it.type === 'rug') continue;
      const busy = it.owner ? people.get(it.owner)?.status?.state === 'working' : busyRooms.has(it.room);
      const depth = it.type === 'chandelier' ? it.x + it.y + 2 : it.x + (it.w ?? 1) + it.y + (it.d ?? 1) - 0.05;
      drawables.push({ depth, room: it.room, draw: () => art.item(it, { busy, night, now }) });
    }
    for (const person of people.values()) {
      drawables.push({ depth: person.x + person.y + 0.55, room: roomAt(person.x, person.y), person });
    }
    const khatib = prayer?.jumatan ? khatibSpot(prayer) : null;
    if (khatib) {
      drawables.push({ depth: khatib.x + khatib.y + 1.2, room: 'musala', draw: () => drawKhatib(khatib, prayer) });
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
      drawPerson(ctx, p.x, p.y + bob + sink, person.look, { frame: settled ? 0 : person.frame, pose, back });
      hitboxes.push({ id: person.id, x: p.x, y: p.y - 14, alpha: ctx.globalAlpha, settled, praying });
    }
    ctx.globalAlpha = 1;

    if (night) drawNight();
    drawLabels(now, prayer, khatib);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Night: dim everything, then add warm light back where lamps and busy screens are.
  function drawNight() {
    ctx.fillStyle = 'rgb(10 14 40 / 0.34)';
    ctx.fillRect(-offset.x / scale, -offset.y / scale, canvas.width / scale, canvas.height / scale);
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
      if (it.type === 'lamp') glow(it.x + 0.5, it.y + 0.5, 26, 46, 'rgb(255 200 110 / 0.35)');
      if (it.type === 'chandelier') glow(it.x + 0.5, it.y + 0.5, WALL - 8, 60, 'rgb(255 210 130 / 0.3)');
      if (it.type === 'desk' && people.get(it.owner)?.status?.state === 'working') {
        glow(it.x + 0.4, it.y + 0.2, 20, 24, 'rgb(90 220 200 / 0.3)');
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Where the Friday khatib stands: on the mimbar for the khutbah, then at the front as imam.
  function khatibSpot(prayer) {
    const spot = prayer.phase === 'salat' ? spots.imam[0] : spots.mimbar[0];
    return spot ? { x: spot.x + 0.5, y: spot.y + 0.5, raised: prayer.phase !== 'salat' } : null;
  }

  function drawKhatib(spot, prayer) {
    const p = corner(spot.x, spot.y);
    const pose = prayer.phase === 'salat' ? salatPose(prayer) : 'stand';
    drawPerson(ctx, p.x, p.y - (spot.raised ? MIMBAR_H : 0), OWNER.look, { pose, back: prayer.phase === 'salat' });
  }

  function drawLabels(now, prayer, khatib) {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, offset.x * dpr, offset.y * dpr);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textPx = Math.round(Math.min(16, Math.max(11, scale * 4.4)));
    const nameFont = `700 ${textPx}px "Plus Jakarta Sans", system-ui, sans-serif`;
    const tagFont = `600 ${textPx - 1}px "Plus Jakarta Sans", system-ui, sans-serif`;

    for (const room of rooms) {
      const p = corner(room.x + room.w / 2, room.y);
      ctx.globalAlpha = dim(room.id);
      ctx.font = `400 ${textPx}px Silkscreen, "Plus Jakarta Sans", system-ui, sans-serif`;
      // Open rooms only have a low railing, so their label sits just above it.
      const lift = room.walls === 'railing' ? 20 : WALL + 8;
      pill(room.label, p.x * scale, (p.y - lift) * scale, 'rgb(18 26 46 / 0.88)', '#edf0f7');
    }

    for (const hit of hitboxes) {
      const person = people.get(hit.id);
      ctx.globalAlpha = hit.alpha;
      const x = hit.x * scale;
      const y = hit.y * scale;
      // A saf of name tags is unreadable; names come back after salat or when you pick someone.
      if (!hit.praying || hit.id === selected) {
        ctx.font = nameFont;
        ctx.fillStyle = hit.id === selected ? '#f4b942' : '#ffffff';
        ctx.strokeStyle = 'rgb(20 16 30 / 0.75)';
        ctx.lineWidth = 3;
        ctx.strokeText(person.name, x, y + 22 * scale);
        ctx.fillText(person.name, x, y + 22 * scale);
      }

      const state = person.status?.state ?? 'idle';
      ctx.font = tagFont;
      if (state !== 'idle' && person.status?.text) {
        // A card over their head with what they're on right now.
        const text = truncate(person.status.text, 28);
        if (state === 'waiting') pill(`! ${text}`, x, y - 16 * scale, '#f4b942', '#2a1d00');
        else tag(text, x, y - 16 * scale, STATUS_DOT[state] ?? '#9ba6c2');
      } else if (person.activity && hit.settled && !['salat', 'imam'].includes(person.activity)) {
        // Chat partners take turns "talking" so the pair reads as a conversation.
        const talking = person.activity !== 'ngobrol' || Math.floor(now / 1500) % 2 === (person.id < person.partner ? 0 : 1);
        if (talking) pill(person.activity === 'ngobrol' ? '…' : person.activity, x, y - 14 * scale, 'rgb(255 255 255 / 0.92)', '#2a3350');
      }
    }

    if (khatib) {
      ctx.globalAlpha = dim('musala');
      const p = corner(khatib.x, khatib.y);
      const x = p.x * scale;
      const y = (p.y - (khatib.raised ? MIMBAR_H : 0) - 14) * scale;
      const name = `${OWNER.name} · khatib`;
      ctx.font = nameFont;
      ctx.fillStyle = '#f4b942';
      ctx.strokeStyle = 'rgb(20 16 30 / 0.75)';
      ctx.lineWidth = 3;
      ctx.strokeText(name, x, y + 22 * scale);
      ctx.fillText(name, x, y + 22 * scale);
      if (prayer.phase === 'khutbah') {
        ctx.font = tagFont;
        pill(KHUTBAH_LINES[Math.floor(now / 6000) % KHUTBAH_LINES.length], x, y - 16 * scale, 'rgb(255 255 255 / 0.95)', '#2a3350');
      }
    }
    ctx.globalAlpha = 1;
  }

  const fontPx = () => Number(ctx.font.match(/(\d+)px/)[1]);

  // Rounded label sized from the current font, so it grows with the office.
  function pill(text, x, y, bg, fg) {
    const w = ctx.measureText(text).width + 12;
    const h = fontPx() + 7;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y + 0.5);
  }

  // White card with a coloured state dot, for what an agent is working on.
  function tag(text, x, y, dot) {
    const size = fontPx();
    const w = ctx.measureText(text).width + size + 16;
    const h = size + 9;
    const left = x - w / 2;
    ctx.fillStyle = 'rgb(20 16 30 / 0.25)';
    ctx.beginPath();
    ctx.roundRect(left + 1, y - h / 2 + 2, w, h, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(left, y - h / 2, w, h, 5);
    ctx.fill();
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(left + 8 + size / 4, y, size / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b2238';
    ctx.textAlign = 'left';
    ctx.fillText(text, left + 12 + size / 2, y + 0.5);
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
    const rect = canvas.getBoundingClientRect();
    zoomAt(event.deltaY < 0 ? 1.15 : 1 / 1.15, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, moved: false };
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drag || camera.zoom <= 1) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    canvas.setPointerCapture(event.pointerId);
    setCamera(camera.zoom, { x: camera.center.x - dx / scale, y: camera.center.y - dy / scale });
    drag.x = event.clientX;
    drag.y = event.clientY;
  });

  canvas.addEventListener('pointerup', () => {
    // Let the click that follows a drag know it was a drag, then forget it.
    setTimeout(() => {
      drag = null;
    });
  });

  canvas.addEventListener('dblclick', () => setCamera(1, { x: world.w / 2, y: world.h / 2 }, { animate: true }));

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
    rooms: () => rooms.map(({ id, label }) => ({ id, label })),
    focus(roomId) {
      focusRoom = roomId;
      floorCache = null;
      const view = roomView(roomId);
      setCamera(view.zoom, view.center, { animate: true });
    },
    zoomBy(factor) {
      zoomAt(factor, canvas.clientWidth / 2, canvas.clientHeight / 2);
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
