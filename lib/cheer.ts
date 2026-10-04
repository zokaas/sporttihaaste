// Viikon tsemppari: äänestys viikon viimeisenä päivänä (sunnuntai) klo 17.00–23.59 Suomen aikaa.
import { helsinkiHour } from './quiet.ts';
import { seasonWeek, weekRange, BOSS_WEEK } from './season.ts';

export const CHEER_OPEN_HOUR = 17;

/** Mikä viikko on äänestettävänä (päivä = viikon viimeinen päivä ja kello vähintään 17), muuten null. */
export function cheerVoteWeek(day: string, hour = helsinkiHour()) {
  const w = seasonWeek(day);
  if (w < 1 || w > BOSS_WEEK) return null;
  return weekRange(w).end === day && hour >= CHEER_OPEN_HOUR ? w : null;
}

export type CheerVote = { week: number; voter: string; nominee: string };

/** Viikon tsemppari äänistä: eniten ääniä saanut (tasapelissä kaikki kärjessä olevat). */
export function cheerWinner(votes: CheerVote[], week: number) {
  const counts = new Map<string, number>();
  for (const v of votes) if (v.week === week) counts.set(v.nominee, (counts.get(v.nominee) ?? 0) + 1);
  const top = Math.max(0, ...counts.values());
  if (!top) return null;
  return { ids: [...counts].filter(([, n]) => n === top).map(([id]) => id), votes: top };
}
