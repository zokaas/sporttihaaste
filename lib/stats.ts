import type { loadBattle } from './battle';
import { hoursInWeek } from './battle';
import { STEP_DAY_DAMAGE } from './rules';
import { addDays, monthDay, seasonWeek } from './season';

export type Battle = Awaited<ReturnType<typeof loadBattle>>;

export type Achievement = { icon: string; title: string; detail: string };

export type HeroStats = {
  id: string;
  name: string;
  avatar: string | null;
  damage: number;
  hitCount: number;
  hours: number;
  stepDays: number;
  longestStreak: number;
  pledgesKept: number;
  closedWeeks: number;
  favourites: { sport: string; count: number }[];
  achievements: Achievement[];
};

/** Pisin peräkkäisten askelpäivien putki. */
function longestStreak(days: string[]) {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** Viikon suurin vahingontekijä (iskut + askeleet) jokaiselta päättyneeltä viikolta. */
export function weekHeroes(b: Battle) {
  const winners: Record<number, string> = {};
  for (let w = 1; w < b.week; w++) {
    const totals = new Map<string, number>();
    for (const h of b.hits) if (seasonWeek(h.trained_on) === w) totals.set(h.user_id, (totals.get(h.user_id) ?? 0) + h.damage);
    for (const s of b.steps) if (seasonWeek(s.day) === w) totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + STEP_DAY_DAMAGE);
    const top = [...totals].sort((a, c) => c[1] - a[1])[0];
    if (top) winners[w] = top[0];
  }
  return winners;
}

/** Kuka löi kunkin kaatuneen monsterin viimeisen iskun. */
export function finalBlows(b: Battle) {
  const byWeek: Record<number, string> = {};
  if (!b.ledger) return byWeek;
  for (const k of b.ledger.killed) {
    const e = b.events.find((x) => x.at === k.killedAt);
    if (e) byWeek[k.week] = e.userId;
  }
  return byWeek;
}

export function heroStats(b: Battle, avatarUrl: (p: string | null) => string | null): HeroStats[] {
  const heroes = b.heroes.filter((h) => h.pledge_locked_at);
  const winners = weekHeroes(b);
  const blows = finalBlows(b);
  return heroes.map((h) => {
    const hits = b.hits.filter((x) => x.user_id === h.id);
    const steps = b.steps.filter((x) => x.user_id === h.id).map((x) => x.day);
    const counts = new Map<string, number>();
    for (const x of hits) counts.set(x.sport, (counts.get(x.sport) ?? 0) + 1);
    let kept = 0;
    for (let w = 1; w < b.week; w++) if (b.pledgeStatus(h.id, w).kept) kept++;
    const streak = longestStreak(steps);

    const achievements: Achievement[] = [];
    for (const [w, id] of Object.entries(winners)) if (id === h.id) achievements.push({ icon: '🏆', title: 'Viikon sankari', detail: `Eniten vahinkoa viikolla ${w}` });
    for (const [w, id] of Object.entries(blows)) {
      if (id !== h.id) continue;
      const m = b.monsters.get(Number(w));
      achievements.push({ icon: '⚔️', title: 'Viimeinen isku', detail: m?.name ?? `Viikon ${w} monsteri` });
    }
    if (streak >= 14) achievements.push({ icon: '👣', title: 'Askelputki 14', detail: `${streak} päivää putkeen` });
    else if (streak >= 7) achievements.push({ icon: '👣', title: 'Askelputki 7', detail: `${streak} päivää putkeen` });
    if (kept >= 3 && kept === b.week - 1) achievements.push({ icon: '🤝', title: 'Sanansa pitävä', detail: `Kaikki ${kept} lupausta pidetty` });

    return {
      id: h.id,
      name: h.hero_name ?? '',
      avatar: avatarUrl(h.avatar_path),
      damage: hits.reduce((a, x) => a + x.damage, 0) + steps.length * STEP_DAY_DAMAGE,
      hitCount: hits.length,
      hours: Array.from({ length: b.week }, (_, i) => hoursInWeek(b.hits, h.id, i + 1)).reduce((a, x) => a + x, 0),
      stepDays: steps.length,
      longestStreak: streak,
      pledgesKept: kept,
      closedWeeks: b.week - 1,
      favourites: [...counts].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([sport, count]) => ({ sport, count })),
      achievements,
    };
  });
}

/** Järjestys: pidetyt lupaukset, sitten vahinko. */
export function rankByPledges(stats: HeroStats[]) {
  return [...stats].sort((a, c) => c.pledgesKept - a.pledgesKept || c.damage - a.damage);
}

/** Tulevat juhlapäivät (nimi- ja syntymäpäivät) seuraavan n päivän ajalta, tänään mukaan lukien. */
export function upcomingCelebrations(b: Battle, days = 14) {
  const list: { day: string; name: string; kind: 'syntymäpäivä' | 'nimipäivä' }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(b.today, i);
    for (const h of b.heroes) {
      if (!h.pledge_locked_at) continue;
      if (h.birthday === monthDay(d)) list.push({ day: d, name: h.hero_name ?? '', kind: 'syntymäpäivä' });
      if (h.name_day === monthDay(d)) list.push({ day: d, name: h.hero_name ?? '', kind: 'nimipäivä' });
    }
  }
  return list;
}

