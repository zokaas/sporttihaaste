// Viikon vaikeus ja oma bonustavoite HP-laskurin (lib/hpcheck.ts) pohjalta.
import type { Battle } from './stats';
import { PATROL_DAY_DAMAGE, STEP_DAY_DAMAGE } from './rules';
import { BOSS_WEEK, helsinkiToday, seasonWeek, weekRange } from './season';
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
 * Oma lisävoimatavoite viikolle: osuus porukan bonustarpeesta lupauksen koon mukaan. Sen voi kattaa
 * bonuksilla (porukka, heikkous, juhlapäivä) tai treenaamalla yli lupauksen. Tavoite olettaa, että lupaus
 * pidetään ja askeleet kuitataan, joten se lasketaan HP-laskurin teoreettisesta tarpeesta.
 * Kertynyt = omien iskujen bonukset + treenien perusvoima lupauksen ylittävältä osalta.
 * Vertailuluvut: yksi bonustreeni ≈ +50 % keskimääräisestä treenistä, yksi lisätunti ≈ 100.
 */
export function heroBonusGoal(b: NonNullable<Battle>, userId: string, week = b.week) {
  if (week < 1 || week >= BOSS_WEEK) return null;
  const sp = seasonPlan(b);
  const p = sp.plan[week - 1];
  if (!p || !sp.totalPledgeHours) return null;
  const share = b.pledgeOf(userId, week) / sp.totalPledgeHours;
  const goal = Math.round(p.need * share);
  const mine = b.hits.filter((h) => h.user_id === userId && seasonWeek(h.trained_on) === week);
  const base = mine.reduce((a, h) => a + Math.round(h.damage / (1 + (h.bonus_pct ?? 0) / 100)), 0);
  const bonus = mine.reduce((a, h) => a + h.damage, 0) - base;
  const status = b.pledgeStatus(userId, week);
  // Lupauksen ylittävä osa voimana: perusvoima, josta vähennetään lupaustavoitteen osuus (100 / tunti).
  const extra = Math.max(0, base - Math.round(status.target * 100));
  const perBonus = Math.round(sp.avgHitBase * 0.5);
  return { goal, done: bonus + extra, bonus, extra, perBonus };
}
