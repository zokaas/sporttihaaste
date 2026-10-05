// Viikon vaikeus ja oma bonustavoite HP-laskurin (lib/hpcheck.ts) pohjalta.
import type { Battle } from './stats';
import { PATROL_DAY_DAMAGE, STEP_DAY_DAMAGE } from './rules';
import { BOSS_WEEK, seasonWeek } from './season';
import { bonusTenths, hpPlan, weekActual, type WeekActual } from './hpcheck';

export type Difficulty = { level: 'easy' | 'medium' | 'hard'; tenths: number; need: number };

/** Treenin keskimääräinen perusvoima päättyneiltä viikoilta (ennen ensimmäistä viikkoa arvio 90). */
function avgHitBase(b: NonNullable<Battle>) {
  const xs = b.hits.filter((h) => seasonWeek(h.trained_on) < b.week).map((h) => h.damage / (1 + (h.bonus_pct ?? 0) / 100));
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
  const closedWeeks = Object.keys(actuals).map(Number).filter((w) => w < b.week);
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
 * Oma bonustavoite viikolle: ryhmän bonustarve jaettuna lupausten suhteessa, yksi bonustreeni = +50 %
 * keskimääräisen treenin perusvoimasta. Tehdyt = viikon omat iskut, joissa on bonusta.
 * Tavoite olettaa, että lupaukset pidetään ja askeleet kuitataan (kuten ohjerivi sanoo), joten se lasketaan
 * teoreettisesta tarpeesta eikä toteutuneesta tahdista.
 */
export function heroBonusGoal(b: NonNullable<Battle>, userId: string, week = b.week) {
  if (week < 1 || week >= BOSS_WEEK) return null;
  const sp = seasonPlan(b);
  const p = sp.plan[week - 1];
  if (!p || !sp.totalPledgeHours) return null;
  const need = p.need;
  const share = b.pledgeOf(userId, week) / sp.totalPledgeHours;
  const goal = need > 0 ? Math.max(1, Math.ceil((need * share) / (sp.avgHitBase * 0.5))) : 0;
  const done = b.hits.filter((h) => h.user_id === userId && seasonWeek(h.trained_on) === week && (h.bonus_pct ?? 0) > 0).length;
  return { goal, done };
}
