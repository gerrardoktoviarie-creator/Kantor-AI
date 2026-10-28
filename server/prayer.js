import { PRAYER } from './config.js';

// Prayer times from the sun's position (the praytimes.org formulas), with the angles
// Kemenag uses: Subuh at 20° below the horizon, Isya at 18°, Ashar at shadow = 1x height.
// Kemenag also adds a 2-minute safety margin (ihtiyath) to every time.
const FAJR_ANGLE = 20;
const ISHA_ANGLE = 18;
const SUNSET_ANGLE = 0.833;
const IHTIYATH_MIN = 2;

export const PRAYERS = [
  { id: 'subuh', name: 'Subuh' },
  { id: 'dzuhur', name: 'Dzuhur' },
  { id: 'ashar', name: 'Ashar' },
  { id: 'maghrib', name: 'Maghrib' },
  { id: 'isya', name: 'Isya' },
];

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const fix = (a, b) => ((a % b) + b) % b;

function sunPosition(jd) {
  const d = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * d, 360);
  const q = fix(280.459 + 0.98564736 * d, 360);
  const l = fix(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * d;
  const ra = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(l)), Math.cos(rad(l)))) / 15, 24);
  return {
    declination: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(l)))),
    equation: q / 15 - ra,
  };
}

function julianDay(year, month, day) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

// Hours between noon and the moment the sun sits `angle` degrees below the horizon.
function hourAngle(angle, lat, declination) {
  const cos = (-Math.sin(rad(angle)) - Math.sin(rad(declination)) * Math.sin(rad(lat)))
    / (Math.cos(rad(declination)) * Math.cos(rad(lat)));
  return deg(Math.acos(Math.min(1, Math.max(-1, cos)))) / 15;
}

function asrAngle(lat, declination) {
  // Altitude at which an object's shadow equals its own length plus its noon shadow.
  return -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(lat - declination))))));
}

/**
 * Prayer times for one calendar day at a place, as Date objects.
 * `utcOffset` is in hours (WIB = 7); the result does not depend on the server's own zone.
 */
export function prayerTimes({ year, month, day }, { lat, lon, utcOffset }) {
  const { declination, equation } = sunPosition(julianDay(year, month, day) - lon / 360 + 0.5);
  const noon = 12 + utcOffset - lon / 15 - equation;

  const hours = {
    subuh: noon - hourAngle(FAJR_ANGLE, lat, declination),
    dzuhur: noon,
    ashar: noon + hourAngle(asrAngle(lat, declination), lat, declination),
    maghrib: noon + hourAngle(SUNSET_ANGLE, lat, declination),
    isya: noon + hourAngle(ISHA_ANGLE, lat, declination),
  };

  const midnightUtc = Date.UTC(year, month - 1, day) - utcOffset * 3600_000;
  const times = {};
  for (const [id, h] of Object.entries(hours)) {
    // Round up to the minute after the margin, like published schedules do.
    const minutes = Math.ceil(h * 60 + IHTIYATH_MIN);
    times[id] = new Date(midnightUtc + minutes * 60_000);
  }
  return times;
}

// Today's schedule where the user lives, plus whether Dzuhur is Jumatan.
export function todaySchedule(now = new Date()) {
  const local = new Date(now.getTime() + PRAYER.utcOffset * 3600_000);
  const date = { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() };
  const times = prayerTimes(date, PRAYER);
  const friday = local.getUTCDay() === 5;
  return {
    city: PRAYER.city,
    utcOffset: PRAYER.utcOffset,
    prayers: PRAYERS.map(({ id, name }) => ({
      id,
      name: id === 'dzuhur' && friday ? 'Jumatan' : name,
      jumatan: id === 'dzuhur' && friday,
      at: times[id].toISOString(),
    })),
  };
}
