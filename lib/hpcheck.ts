// HP:n realismi: paljonko bonuksia monsterin kaatamiseen tarvitaan lupausten ja askelten päälle.
import { STEPS_WEEKLY_ESTIMATE } from './rules.ts';
import { BOSS_WEEK } from './season.ts';

export type WeekActual = { trainingBase: number; bonus: number; steps: number; kela: number };
export type WeekPlan = {
  week: number;
  hp: number;
  /** Treenivoima ilman bonuksia, jos kaikki pitävät lupauksensa. */
  pledgeBase: number;
  /** Askelten arvio (10 hlö × 5 päivää × 50 + megamarssi viikossa). */
  stepsEst: number;
  /** Bonuksia tarvitaan lupausten ja askelten päälle. */
  need: number;
  /** Tarvittava bonus prosentteina lupausten treenivoimasta. */
  needPct: number;
  /** Sama, jos treenit ja askeleet toteutuvat tähänastisella tahdilla (null, jos tahtia ei vielä tiedetä). */
  needPctAtPace: number | null;
  /** Bonusta tarvitaan voimana tällä tahdilla (null, jos tahtia ei vielä tiedetä). */
  needAtPace: number | null;
  actual: WeekActual | null;
};

/** Viikon 1 pituus on 4 päivää (to–su), muut 7. */
const daysOf = (w: number) => (w === 1 ? 4 : 7);

/**
 * Laskee jokaiselle viikolle, paljonko bonuksia monsterin HP vaatii, kun lupaukset pidetään ja askeleet
 * kuitataan arvion mukaan, sekä toteutuneella tahdilla (päättyneiden viikkojen treenit / lupaukset ja askeleet / arvio).
 */
export function hpPlan(totalPledgeHours: number, hpByWeek: number[], actuals: Record<number, WeekActual>, closedWeeks: number[]): WeekPlan[] {
  const base = (w: number) => (totalPledgeHours * 100 * daysOf(w)) / 7;
  const steps = (w: number) => (STEPS_WEEKLY_ESTIMATE * daysOf(w)) / 7;
  const closed = closedWeeks.filter((w) => actuals[w]);
  const pledgeRate = closed.length ? closed.reduce((a, w) => a + actuals[w].trainingBase, 0) / closed.reduce((a, w) => a + base(w), 0) : null;
  const stepRate = closed.length ? closed.reduce((a, w) => a + actuals[w].steps, 0) / closed.reduce((a, w) => a + steps(w), 0) : null;
  return hpByWeek.map((hp, i) => {
    const week = i + 1;
    const pledgeBase = Math.round(base(week));
    const stepsEst = Math.round(steps(week));
    const need = Math.max(0, hp - pledgeBase - stepsEst);
    let needPctAtPace: number | null = null;
    let needAtPace: number | null = null;
    if (pledgeRate != null && stepRate != null && pledgeRate > 0) {
      const trained = pledgeRate * pledgeBase;
      needAtPace = Math.round(Math.max(0, hp - trained - stepRate * stepsEst));
      needPctAtPace = Math.round((needAtPace / trained) * 100);
    }
    return { week, hp, pledgeBase, stepsEst, need, needPct: pledgeBase ? Math.round((need / pledgeBase) * 100) : 0, needPctAtPace, needAtPace, actual: actuals[week] ?? null };
  }).filter((p) => p.week <= BOSS_WEEK);
}

/** Kuinka moni treeni kymmenestä tarvitsee yhden bonuksen (+50 %), kun bonusta tarvitaan pct % treenien päälle. */
export const bonusTenths = (pct: number) => Math.round(pct / 5);

/** Toteutunut viikko: treenien voima ilman bonuksia, bonukset, askeleet (+ megamarssit) ja Kela. */
export function weekActual(hits: { damage: number; bonus_pct: number | null }[], stepDays: number, patrolDays: number, stepDamage: number, patrolDamage: number, kela = 0): WeekActual {
  const trainingBase = hits.reduce((a, h) => a + Math.round(h.damage / (1 + (h.bonus_pct ?? 0) / 100)), 0);
  const total = hits.reduce((a, h) => a + h.damage, 0);
  return { trainingBase, bonus: total - trainingBase, steps: stepDays * stepDamage + patrolDays * patrolDamage, kela };
}
