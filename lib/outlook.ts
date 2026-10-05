// Viikon vaikeus ja oma bonustavoite HP-laskurin (lib/hpcheck.ts) pohjalta.
import type { Battle } from './stats';
import { PATROL_DAY_DAMAGE, STEP_DAY_DAMAGE } from './rules';
import { addDays, BOSS_WEEK, helsinkiToday, seasonWeek, weekRange } from './season';
import { isSickOn } from './weekly';
import { bonusTenths, hpPlan, weekActual, type WeekActual } from './hpcheck';

export type Difficulty = { level: 'easy' | 'medium' | 'hard'; tenths: number; need: number };

/** Treenin keskimääräinen perusvoima päättyneiltä viikoilta (ennen ensimmäistä viikkoa arvio 90). */
function avgHitBase(b: NonNullable<Battle>) {
  const xs = b.hits.filter((h) => seasonWeek(h.trained_on) < b.week && weekRange(seasonWeek(h.trained_on)).end < helsinkiToday()).map((h) => h.damage / (1 + (h.bonus_pct ?? 0) / 100));
  return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 90;
}

/** HP-laskelma kaudelle nykyisillä lupauksilla ja toteutuneella tahdilla. */
export function seasonPlan(b: NonNullable<Battle>, totalPledgeHours = b.participants.reduce((a, u) => a + b.pledgeOf(u, b.week), 0)) {
  const hpByWeek = Array.from({ length: BOSS_WEEK }, (_, i) => b.monsters.get(i + 1)?.hp ?? 0);
  const actuals: Record<number, WeekActual> = {};
  for (let w = 1; w <= Math.min(b.week, BOSS_WEEK); w++) {
    actuals[w] = weekActual(
      b.hits.filter((x) => seasonWeek(x.trained_on) === w),
      b.steps.filter((x) => seasonWeek(x.day) === w).length,
      b.patrols.filter((x) => seasonWeek(x.day) === w).length,
      STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE,
      b.kela.filter((x) => seasonWeek(x.day) === w).reduce((a, x) => a + x.damage, 0),
    );
  }
  // Tahti vain oikeasti päättyneiltä viikoilta: esikatselun testipäivänä kesken oleva viikko ei vääristä sitä.
  const realToday = helsinkiToday();
  const closedWeeks = Object.keys(actuals).map(Number).filter((w) => w < b.week && weekRange(w).end < realToday);
  return { plan: hpPlan(totalPledgeHours, hpByWeek, actuals, closedWeeks), actuals, closedWeeks, totalPledgeHours, avgHitBase: avgHitBase(b) };
}

/**
 * Viikon vaikeus: kuinka moni treeni kymmenestä tarvitsee bonuksen (tällä tahdilla, jos tiedossa).
 * Helppo alle 3/10, keski 3–6/10, vaikea yli 6/10. Loppupomolle ei lasketa (ensi-isku muuttaa tarpeen).
 */
export function weekDifficulty(b: NonNullable<Battle>, week = b.week): Difficulty | null {
  if (week < 1 || week >= BOSS_WEEK || !b.monsters.get(week)?.hp) return null;
  const p = seasonPlan(b).plan[week - 1];
  if (!p) return null;
  const tenths = bonusTenths(p.needPctAtPace ?? p.needPct);
  return { level: tenths < 3 ? 'easy' : tenths <= 6 ? 'medium' : 'hard', tenths, need: p.needAtPace ?? p.need };
}

/**
 * Sankarin viikon lisävoima: omien iskujen bonukset + treenien perusvoima lupaustavoitteen (100 / h) ylittävältä
 * osalta + askelpäivät yli tavoitteen (5 / 7 terveistä päivistä).
 */
function heroExtra(b: NonNullable<Battle>, userId: string, week: number) {
  const mine = b.hits.filter((h) => h.user_id === userId && seasonWeek(h.trained_on) === week);
  const base = mine.reduce((a, h) => a + Math.round(h.damage / (1 + (h.bonus_pct ?? 0) / 100)), 0);
  const bonus = mine.reduce((a, h) => a + h.damage, 0) - base;
  const over = Math.max(0, base - Math.round(b.pledgeStatus(userId, week).target * 100));
  const { start, end } = weekRange(week);
  let healthy = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (!isSickOn(b.periods, userId, d)) healthy++;
  const stepDays = b.steps.filter((s) => s.user_id === userId && s.day >= start && s.day <= end && !isSickOn(b.periods, userId, s.day)).length;
  const steps = Math.max(0, stepDays - Math.round((5 * healthy) / 7)) * STEP_DAY_DAMAGE;
  return bonus + over + steps;
}

/**
 * Porukan yhteinen lisävoima viikolle: tavoite on HP-laskurin teoreettinen bonustarve (lupaukset pidetään ja
 * askeleet kuitataan), kertynyt on kaikkien sankarien lisävoima. `mine` on sankarin oma osuus (ei tavoitetta).
 */
export function teamExtra(b: NonNullable<Battle>, userId: string, week = b.week) {
  if (week < 1 || week >= BOSS_WEEK) return null;
  const p = seasonPlan(b).plan[week - 1];
  if (!p || p.need <= 0) return null;
  const done = b.participants.reduce((a, u) => a + heroExtra(b, u, week), 0);
  return { goal: p.need, done, mine: heroExtra(b, userId, week) };
}
