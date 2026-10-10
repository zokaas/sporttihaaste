// Viikon vaikeus ja oma bonustavoite HP-laskurin (lib/hpcheck.ts) pohjalta.
import type { Battle } from './stats';
import { PATROL_DAY_DAMAGE, STEP_DAY_DAMAGE } from './rules';
import { BOSS_WEEK, helsinkiToday, seasonWeek, weekRange } from './season';
import { bonusTenths, hpPlan, weekActual, type WeekActual } from './hpcheck';

export type Difficulty = { level: 'easy' | 'medium' | 'hard' | 'mega'; tenths: number; need: number };

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

/** Onko viikon oma monsteri jo kaatunut (silloin vaikeutta ei enää näytetä). */
const weekKilled = (b: NonNullable<Battle>, week: number) => Boolean(b.ledger?.killed.some((k) => k.week === week));

/**
 * Viikon vaikeus: kuinka moni treeni kymmenestä tarvitsee bonuksen (tällä tahdilla, jos tiedossa).
 * Helppo 0/10, keski 1–4/10, vaikea 5–8/10, megamonsteri 9/10 tai enemmän. Loppupomolle ei lasketa (ensi-isku muuttaa tarpeen).
 */
export function weekDifficulty(b: NonNullable<Battle>, week = b.week): Difficulty | null {
  if (week < 1 || week >= BOSS_WEEK || !b.monsters.get(week)?.hp || weekKilled(b, week)) return null;
  const p = seasonPlan(b).plan[week - 1];
  if (!p) return null;
  const tenths = bonusTenths(p.needPctAtPace ?? p.needPct);
  const level = tenths === 0 ? 'easy' : tenths <= 4 ? 'medium' : tenths <= 8 ? 'hard' : 'mega';
  return { level, tenths, need: p.needAtPace ?? p.need };
}
