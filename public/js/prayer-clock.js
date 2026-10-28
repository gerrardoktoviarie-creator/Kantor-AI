// How long the office spends on each prayer, in minutes after the adzan.
// Jumatan gets a khutbah between gathering and the salat itself.
const GATHER_MIN = 3;
const KHUTBAH_MIN = 12;
const SALAT_MIN = 9;

const MINUTE = 60_000;

function timeline(prayer) {
  const start = new Date(prayer.at).getTime();
  const khutbah = prayer.jumatan ? KHUTBAH_MIN : 0;
  const salatStart = start + (GATHER_MIN + khutbah) * MINUTE;
  return { start, khutbahStart: start + GATHER_MIN * MINUTE, salatStart, end: salatStart + SALAT_MIN * MINUTE };
}

// The prayer happening right now, or null. `phase` is gather | khutbah | salat.
export function currentPrayer(schedule, now = Date.now()) {
  for (const prayer of schedule?.prayers ?? []) {
    const t = timeline(prayer);
    if (now < t.start || now >= t.end) continue;
    let phase = 'salat';
    if (now < t.khutbahStart) phase = 'gather';
    else if (now < t.salatStart) phase = 'khutbah';
    return { ...prayer, phase, start: t.start, salatStart: t.salatStart, end: t.end };
  }
  return null;
}

export function nextPrayer(schedule, now = Date.now()) {
  return schedule?.prayers.find((p) => new Date(p.at).getTime() > now) ?? null;
}

// Pose for one moment of a rakaat. The cycle repeats until the salat window ends.
const RAKAAT = [
  ['stand', 6], ['rukuk', 3], ['stand', 2], ['sujud', 3], ['sit', 2], ['sujud', 3],
];
const RAKAAT_SECONDS = RAKAAT.reduce((sum, [, s]) => sum + s, 0);

export function salatPose(prayer, now = Date.now()) {
  let t = ((now - prayer.salatStart) / 1000) % RAKAAT_SECONDS;
  for (const [pose, seconds] of RAKAAT) {
    if (t < seconds) return pose;
    t -= seconds;
  }
  return 'stand';
}
