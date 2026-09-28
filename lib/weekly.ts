// Viikkokohtaiset säännöt: sairaus, askeleet, megamarssit ja lupaukset. Puhtaita funktioita.
import { addDays, weekRange } from './season.ts';

export type SickPeriod = { user_id: string; starts_on: string; ends_on: string | null };

/** Oliko sankari kipeä annettuna päivänä? ends_on on viimeinen sairaspäivä, null = yhä kipeä. */
export function isSickOn(periods: SickPeriod[], userId: string, day: string) {
  return periods.some((p) => p.user_id === userId && p.starts_on <= day && (p.ends_on === null || p.ends_on >= day));
}

/** Sairaspäivät välillä start–end (molemmat mukaan). */
export function sickDaysBetween(periods: SickPeriod[], userId: string, start: string, end: string) {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (isSickOn(periods, userId, d)) n++;
  return n;
}

export function daysInWeek(week: number) {
  const { start, end } = weekRange(week);
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) n++;
  return n;
}

/**
 * Viikon lupaustavoite tunteina. Lyhyellä viikolla 1 (to–su, 4 pv) tavoite on lupaus × 4/7.
 * Sairaspäivät vähennetään, ja tulos pyöristetään lähimpään puoleen tuntiin (vrt. adjustedPledge).
 */
export function weekPledgeTarget(pledge: number, week: number, sickDays: number) {
  const days = daysInWeek(week);
  const healthy = Math.max(0, days - Math.min(days, sickDays));
  return Math.round(((pledge * healthy) / 7) * 2) / 2;
}

/** Voimassa oleva lupaus viikolla: viimeisin muutos, joka alkaa viimeistään tällä viikolla. */
export function pledgeForWeek(base: number, changes: { from_week: number; hours: number }[], week: number) {
  const c = changes.filter((x) => x.from_week <= week).sort((a, b) => b.from_week - a.from_week)[0];
  return c ? Number(c.hours) : base;
}

/**
 * Megamarssit: päivät, joina jokainen sinä päivänä terve osallistuja on kuitannut askeleensa.
 * Palauttaa päivän ja hetken, jolloin viimeinen kuittaus tuli (määrää järjestyksen kirjanpidossa).
 */
export function patrolDays(
  steps: { user_id: string; day: string; created_at: string }[],
  participants: string[],
  periods: SickPeriod[],
) {
  const byDay = new Map<string, Map<string, string>>();
  for (const s of steps) {
    if (!byDay.has(s.day)) byDay.set(s.day, new Map());
    byDay.get(s.day)!.set(s.user_id, s.created_at);
  }
  const result: { day: string; at: string }[] = [];
  for (const [day, who] of byDay) {
    const healthy = participants.filter((u) => !isSickOn(periods, u, day));
    if (healthy.length === 0 || !healthy.every((u) => who.has(u))) continue;
    result.push({ day, at: healthy.map((u) => who.get(u)!).sort().at(-1)! });
  }
  return result.sort((a, b) => a.day.localeCompare(b.day));
}

/** Sinettiin vaaditaan viikon osallistujat, jotka eivät ole olleet kipeinä yhtenäkään viikon päivänä. */
export function requiredForSeal(participants: string[], periods: SickPeriod[], week: number, today: string) {
  const { start, end } = weekRange(week);
  const last = end < today ? end : today;
  return participants.filter((u) => sickDaysBetween(periods, u, start, last) === 0);
}
