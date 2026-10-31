// What each room looks like and where things stand in it. Rooms are ROOM_W x ROOM_H tiles.
export const ROOM_W = 8;
export const ROOM_H = 7;

// Warm wood and stone with one navy accent, after a top-down pixel office the owner picked:
// wood-panelled offices, grey tile where the machines are, a dark marble corridor between.
export const THEMES = {
  lobby: { floor: 'woodDark', wall: '#9a6a46', label: 'Lobby' },
  sosmed: { floor: 'wood', wall: '#b88d67' },
  it: { floor: 'tileGrey', wall: '#8e939a' },
  tugas: { floor: 'woodLight', wall: '#a98463' },
  marketing: { floor: 'wood', wall: '#a8765a' },
  admin: { floor: 'tileGrey', wall: '#9a958c' },
  rapat: { floor: 'wood', wall: '#8f6a4c', walls: 'glass', label: 'Ruang rapat' },
  pantry: { floor: 'woodLight', wall: '#c2a585', label: 'Pantry' },
  musala: { floor: 'prayer', wall: '#d9caa6', label: 'Musala', windows: false },
  kolam: { floor: 'deck', wall: '#d9d4c8', walls: 'railing', label: 'Kolam' },
};

// Picked in the setup wizard. Each style only overrides floors and wall colours;
// furniture and layout stay the same so agents behave identically.
const STYLES = {
  modern: {},
  hangat: {
    floor: { lobby: 'wood', it: 'woodLight', admin: 'woodLight' },
    wall: {
      lobby: '#b58457', sosmed: '#c49a72', it: '#a88a6a', tugas: '#b89a74',
      marketing: '#b88462', admin: '#a88f70', rapat: '#9c6e48', pantry: '#c9a77c',
    },
  },
  // Walnut panelling and darker boards; the machine rooms keep their grey tile.
  mewah: {
    floor: { sosmed: 'woodDark', tugas: 'wood', marketing: 'woodDark', pantry: 'marble', rapat: 'woodDark' },
    wall: {
      lobby: '#6b4a33', sosmed: '#7a5a3f', it: '#6e737b', tugas: '#7c5d42',
      marketing: '#734f39', admin: '#76716a', rapat: '#5e4230', pantry: '#8e7458',
    },
  },
};

export function themeFor(id, style = 'modern') {
  const base = THEMES[id] ?? THEMES.it;
  const overrides = STYLES[style] ?? STYLES.modern;
  return {
    ...base,
    floor: overrides.floor?.[id] ?? base.floor,
    wall: overrides.wall?.[id] ?? base.wall,
  };
}

// Desk positions inside a division room, for up to six people.
const DESK_SLOTS = [[1, 1], [3, 1], [5, 1], [1, 3], [3, 3], [5, 3]];

export const emptySpots = () => ({
  coffee: [], sofa: [], chat: [], meeting: [], debate: [], chill: [], lounger: [], swim: [],
  saf: [], wudhu: [], imam: [], mimbar: [],
});

export function furnishRoom(room, agents) {
  const { x, y } = room;
  const items = [];
  const decals = [];
  const blocked = [];
  const seats = new Map();
  const spots = emptySpots();
  const pools = [];

  const block = (tx, ty, w = 1, d = 1) => {
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) blocked.push(`${tx + i},${ty + j}`);
  };
  const add = (type, tx, ty, props = {}, solid = true) => {
    items.push({ type, x: tx, y: ty, ...props });
    if (solid) block(Math.floor(tx), Math.floor(ty), Math.ceil(props.w ?? 1), Math.ceil(props.d ?? 1));
  };
  const desk = (tx, ty, owner) => {
    items.push({ type: 'desk', x: tx + 0.08, y: ty + 0.12, w: 0.84, d: 0.62, owner });
    block(tx, ty);
    items.push({ type: 'chair', x: tx, y: ty + 1, shadow: false });
    seats.set(owner, { x: tx, y: ty + 1 });
  };
  const plant = (tx, ty, tall = true) => add('plant', tx, ty, { tall });

  // Rooms are walled on all four sides; the doors open onto the corridors below and to the right.
  room.doors = { bottom: 3, right: 3 };

  switch (room.id) {
    case 'lobby': {
      decals.push({ wall: 'top', at: 4, type: 'logo' }, { wall: 'top', at: 5, type: 'logo' },
        { wall: 'left', at: 4, type: 'painting' }, { wall: 'left', at: 5, type: 'clock' });
      add('reception', x + 3, y + 2.1, { w: 3, d: 0.8 });
      const builder = agents[0];
      items.push({ type: 'chair', x: x + 4, y: y + 1, shadow: false });
      seats.set(builder.id, { x: x + 4, y: y + 1 });
      add('rug', x + 1, y + 4, { w: 3, d: 2, color: '#2f3d5e' }, false);
      add('coffeeTable', x + 1.6, y + 4.3, { w: 1.6, d: 0.6 });
      add('sofa', x + 1, y + 5.2, { w: 2, d: 0.75, color: 'leather' }, false);
      spots.sofa.push({ x: x + 1, y: y + 5 }, { x: x + 2, y: y + 5 });
      add('chandelier', x + 4, y + 4, {}, false);
      // Open floor by the reception: lobby debates, and meetings when there's no meeting room.
      // Spread over different screen columns so nobody stands behind someone else or the plant.
      spots.debate.push({ x: x + 4, y: y + 3 }, { x: x + 6, y: y + 3 }, { x: x + 5, y: y + 5 }, { x: x + 3, y: y + 4 });
      plant(x + 7, y);
      plant(x + 7, y + 6);
      plant(x, y);
      add('lamp', x + 4, y + 6, {}, true);
      break;
    }
    case 'rapat': {
      add('longTable', x + 2, y + 2, { w: 4, d: 2 });
      const around = [[2, 1], [3, 1], [4, 1], [5, 1], [1, 2], [1, 3], [6, 2], [6, 3], [2, 4], [3, 4], [4, 4], [5, 4]];
      for (const [tx, ty] of around) {
        spots.meeting.push({ x: x + tx, y: y + ty });
        items.push({ type: 'chair', x: x + tx, y: y + ty, shadow: false });
      }
      plant(x + 7, y + 6);
      plant(x, y + 6);
      add('chandelier', x + 4, y + 3, {}, false);
      break;
    }
    case 'pantry': {
      decals.push({ wall: 'left', at: 4, type: 'poster', color: '#5ec4b6' }, { wall: 'left', at: 5, type: 'painting' });
      add('counter', x, y, { w: 4, d: 0.8 });
      add('coffee', x + 1.2, y + 0.2, {}, false);
      add('fridge', x + 6.1, y + 0.05, { w: 0.85, d: 0.8 });
      spots.coffee.push({ x: x + 1, y: y + 1 }, { x: x + 2, y: y + 1 }, { x: x + 3, y: y + 1 });
      for (const [tx, ty] of [[2, 4], [5, 4]]) {
        add('roundTable', x + tx, y + ty);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]]) {
          spots.chat.push({ x: x + tx + dx, y: y + ty + dy });
          items.push({ type: 'stool', x: x + tx + dx, y: y + ty + dy, shadow: false });
        }
      }
      plant(x + 7, y + 6);
      break;
    }
    case 'musala': {
      decals.push({ wall: 'top', at: 4, type: 'mihrab' }, { wall: 'top', at: 2, type: 'calligraphy' }, { wall: 'top', at: 6, type: 'calligraphy' });
      add('rug', x + 4, y + 1, { w: 1, d: 1, color: '#8a2f2f' }, false);
      spots.imam.push({ x: x + 4, y: y + 1 });
      // Each row fills from the middle outwards, like a real saf.
      for (let row = 0; row < 3; row++) {
        for (const tx of [4, 3, 5, 2, 6, 1]) spots.saf.push({ x: x + tx, y: y + 2 + row });
      }
      add('mimbar', x + 6.1, y + 0.1, { w: 0.8, d: 0.5 });
      spots.mimbar.push({ x: x + 6, y });
      for (const at of [4, 5, 6]) {
        decals.push({ wall: 'left', at, type: 'tap' });
        spots.wudhu.push({ x, y: y + at });
      }
      add('shoeRack', x + 7.05, y + 6.1, { w: 0.9, d: 0.8 });
      add('chandelier', x + 4, y + 3, {}, false);
      plant(x, y, false);
      break;
    }
    case 'kolam': {
      // The loungers run along the bottom row, so the door sits past them.
      room.doors.bottom = 5;
      pools.push({ type: 'pool', x: x + 1, y: y + 1, w: 5, d: 3 });
      block(x + 1, y + 1, 5, 3);
      // Swim spots sit on the pool's edge tiles so agents can step straight in from the deck.
      spots.swim.push({ x: x + 2, y: y + 3 }, { x: x + 4, y: y + 3 }, { x: x + 5, y: y + 2 });
      for (const tx of [1, 2, 3]) {
        add('lounger', x + tx, y + 5, { d: 1.6 }, false);
        spots.lounger.push({ x: x + tx, y: y + 5 });
      }
      add('umbrella', x + 5, y + 5);
      plant(x + 7, y);
      plant(x + 7, y + 6);
      plant(x, y + 6, false);
      break;
    }
    default: {
      agents.forEach((agent, i) => {
        const [tx, ty] = DESK_SLOTS[i % DESK_SLOTS.length];
        desk(x + tx, y + ty, agent.id);
      });
      plant(x + 7, y);
      furnishDivision(room, { add, plant, decals, spots, block });
    }
  }

  return { items: items.map((it) => ({ ...it, room: room.id })), decals, blocked, seats, spots, pools };
}

function furnishDivision(room, { add, plant, decals, spots }) {
  const { x, y } = room;
  if (room.id === 'sosmed') {
    decals.push({ wall: 'left', at: 4, type: 'greenscreen' }, { wall: 'left', at: 5, type: 'greenscreen' }, { wall: 'top', at: 6, type: 'poster', color: '#e0607e' });
    add('ringlight', x + 2, y + 6, {}, false);
    add('camera', x + 3, y + 5, {}, false);
    spots.chill.push({ x: x + 1, y: y + 5 });
    add('sofa', x + 5, y + 5.3, { w: 2, d: 0.7, color: 'sofa' }, false);
    spots.sofa.push({ x: x + 5, y: y + 5 }, { x: x + 6, y: y + 5 });
  } else if (room.id === 'it') {
    decals.push({ wall: 'top', at: 4, type: 'whiteboard' }, { wall: 'left', at: 5, type: 'poster', color: '#06d6a0' });
    add('rack', x + 7.1, y + 1.1, { w: 0.8, d: 0.8 });
    add('rack', x + 7.1, y + 2.1, { w: 0.8, d: 0.8 });
    add('beanbag', x + 6, y + 5, {}, false);
    spots.chill.push({ x: x + 6, y: y + 5 });
    plant(x, y + 6, false);
  } else if (room.id === 'tugas') {
    decals.push({ wall: 'left', at: 4, type: 'whiteboard' }, { wall: 'left', at: 5, type: 'painting' });
    add('bookshelf', x + 3, y + 0.05, { w: 2, d: 0.6 });
    add('bookshelf', x + 5, y + 0.05, { w: 2, d: 0.6 });
    add('rug', x + 1, y + 4, { w: 3, d: 2, color: '#4f6178' }, false);
    add('beanbag', x + 5, y + 4, {}, false);
    spots.chill.push({ x: x + 5, y: y + 4 });
    add('lamp', x + 6, y + 4);
  } else if (room.id === 'marketing') {
    decals.push({ wall: 'top', at: 4, type: 'tv' }, { wall: 'left', at: 5, type: 'poster', color: '#f4b942' });
    add('sofa', x + 1, y + 5.3, { w: 2, d: 0.7, color: 'sofa' }, false);
    spots.sofa.push({ x: x + 1, y: y + 5 }, { x: x + 2, y: y + 5 });
    plant(x + 7, y + 6);
  } else if (room.id === 'admin') {
    // Shelving lines the right wall up to row 4.
    room.doors.right = 5;
    decals.push({ wall: 'top', at: 4, type: 'whiteboard' }, { wall: 'left', at: 5, type: 'clock' });
    add('shelving', x + 7.05, y + 1.1, { w: 0.9, d: 0.8 });
    add('shelving', x + 7.05, y + 3.1, { w: 0.9, d: 0.8 });
    add('boxes', x + 5, y + 5);
    add('boxes', x + 6, y + 5);
    add('cabinet', x + 1.1, y + 5.2, { w: 0.8, d: 0.6 });
    plant(x + 7, y + 6, false);
  }
}
