import type { loadBattle } from './battle';
import { addDays, seasonWeek, weekRange } from './season';
import { isSickOn, weekPledgeTarget } from './weekly';
import { heroBonusGoal } from './outlook';

/** Minun viikkoni -kortin tiedot. */
export function myWeekProps(b: NonNullable<Awaited<ReturnType<typeof loadBattle>>>, userId: string, week = b.week) {
  const { start, end } = weekRange(week);
  const days: { day: string; stepped: boolean; future: boolean; patrol: boolean; sick: boolean }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push({
      day: d,
      stepped: b.steps.some((s) => s.user_id === userId && s.day === d),
      future: d > b.today,
      patrol: b.patrols.some((p) => p.day === d),
      sick: d <= b.today && isSickOn(b.periods, userId, d),
    });
  }
  const status = b.pledgeStatus(userId, week);
  const myHits = b.hits.filter((h) => h.user_id === userId && seasonWeek(h.trained_on) === week);
  const stepDamage = days.filter((d) => d.stepped).length * 50;
  return {
    week,
    // Armonaikana (ma klo 12 asti) edellinen viikko näytetään omana korttinaan.
    grace: week < b.week,
    days,
    target: status.target,
    hours: status.hours,
    sickDays: status.sickDays,
    sick: week === b.week && b.sickNow.includes(userId),
    sickSince: b.periods.find((x) => x.user_id === userId && x.ends_on === null)?.starts_on ?? null,
    fullTarget: weekPledgeTarget(b.pledgeOf(userId, week), week, 0),
    inSeal: week === b.week ? b.required.includes(userId) : !b.periods.some((x) => x.user_id === userId && x.starts_on <= end && (x.ends_on === null || x.ends_on >= start)),
    weekDamage: myHits.reduce((a, h) => a + h.damage, 0) + stepDamage,
    stepDamage,
    togetherCount: b.hits.filter((h) => seasonWeek(h.trained_on) === week && h.companions.length >= 2 && (h.user_id === userId || h.companions.includes(userId))).length,
    pledge: b.pledgeOf(userId, week),
    bonusGoal: heroBonusGoal(b, userId, week),
  };
}
