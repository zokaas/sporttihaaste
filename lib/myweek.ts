import type { loadBattle } from './battle';
import { addDays, seasonWeek, weekRange } from './season';

/** Minun viikkoni -kortin tiedot. */
export function myWeekProps(b: NonNullable<Awaited<ReturnType<typeof loadBattle>>>, userId: string) {
  const { start, end } = weekRange(b.week);
  const days: { day: string; stepped: boolean; future: boolean; patrol: boolean }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push({
      day: d,
      stepped: b.steps.some((s) => s.user_id === userId && s.day === d),
      future: d > b.today,
      patrol: b.patrols.some((p) => p.day === d),
    });
  }
  const status = b.pledgeStatus(userId, b.week);
  const myHits = b.hits.filter((h) => h.user_id === userId && seasonWeek(h.trained_on) === b.week);
  const stepDamage = days.filter((d) => d.stepped).length * 50;
  const next = b.changes.find((c) => c.user_id === userId && c.from_week === b.week + 1);
  return {
    week: b.week,
    days,
    target: status.target,
    hours: status.hours,
    sickDays: status.sickDays,
    sick: b.sickNow.includes(userId),
    weekDamage: myHits.reduce((a, h) => a + h.damage, 0) + stepDamage,
    stepDamage,
    togetherCount: b.hits.filter((h) => seasonWeek(h.trained_on) === b.week && h.companions.length >= 2 && (h.user_id === userId || h.companions.includes(userId))).length,
    pledge: b.pledgeOf(userId, b.week),
    nextPledge: next ? Number(next.hours) : null,
    canChangePledge: b.week < 11 && seasonWeek(b.today) >= 1,
  };
}
