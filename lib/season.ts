// Kauden kalenteri. Päivät käsitellään Suomen aikaa merkkijonoina muodossa VVVV-KK-PP.
// Sama laskenta on tietokannassa funktiona public.season_week.

export const SEASON_START = '2026-10-01'; // to, viikko 1 alkaa (pidennetty viikko)
export const WEEK2_START = '2026-10-12'; // ma, viikosta 2 alkaen viikot ovat ma–su
export const SEASON_END = '2026-12-20'; // su, loppupomon viikko (11) päättyy

const DAY = 86_400_000;
const toMs = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(iso: string, days: number) {
  return fromMs(toMs(iso) + days * DAY);
}

/** Tämä päivä Suomen aikaa. */
export function helsinkiToday(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki' }).format(now);
}

/** Kauden viikko 1–11. 0 = ennen kautta, 12 = kauden jälkeen. */
export function seasonWeek(iso: string) {
  if (iso < SEASON_START) return 0;
  if (iso > SEASON_END) return 12;
  if (iso < WEEK2_START) return 1;
  return Math.min(11, 2 + Math.floor((toMs(iso) - toMs(WEEK2_START)) / (7 * DAY)));
}

/** Viikon ensimmäinen ja viimeinen päivä. */
export function weekRange(week: number) {
  if (week === 1) return { start: SEASON_START, end: addDays(WEEK2_START, -1) };
  const start = addDays(WEEK2_START, (week - 2) * 7);
  return { start, end: addDays(start, 6) };
}

/** Viikon päivät, joille voi vielä kirjata: viikon alusta tähän päivään asti. */
export function loggableDays(today: string) {
  const week = seasonWeek(today);
  if (week < 1 || week > 11) return [];
  const days: string[] = [];
  for (let d = weekRange(week).start; d <= today; d = addDays(d, 1)) days.push(d);
  return days;
}

const WEEKDAYS = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

/** Esim. "to 1.10." */
export function formatDay(iso: string) {
  const wd = WEEKDAYS[new Date(toMs(iso)).getUTCDay()];
  return `${wd} ${+iso.slice(8, 10)}.${+iso.slice(5, 7)}.`;
}

/** KK-PP, jota juhlapäivät käyttävät. */
export const monthDay = (iso: string) => iso.slice(5, 10);


/** Hetki (ms) annettuna päivänä ja kellonaikana Suomen aikaa. Huomioi kesäajan (+03) ja talviajan (+02). */
export function helsinkiMs(iso: string, time = '23:59:59') {
  for (const offset of ['+03:00', '+02:00']) {
    const ms = Date.parse(`${iso}T${time}${offset}`);
    const f = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(ms));
    if (f.replace(' ', 'T') === `${iso}T${time}`) return ms;
  }
  return Date.parse(`${iso}T${time}+02:00`);
}
