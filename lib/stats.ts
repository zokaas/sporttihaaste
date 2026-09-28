import type { loadBattle } from './battle';
import { hoursInWeek } from './battle';
import { STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE, computeLedger } from './rules';
import { addDays, formatDay, monthDay, seasonWeek, weekRange, BOSS_WEEK } from './season';

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
    for (const [w, id] of Object.entries(winners)) if (id === h.id) achievements.push({ icon: '🏆', title: 'Viikon sankari', detail: `Eniten voimaa viikolla ${w}` });
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


export type WeekRecap = {
  week: number;
  killed: string[];
  survived: { name: string; hp: number }[];
  damage: number;
  bonusShare: number;
  potGain: number;
  pot: number;
  lostToSeal: number;
  mvp: { name: string; damage: number } | null;
  pledgesKept: number;
  participants: number;
  patrolDays: number;
  stepDays: number;
  jointTrainings: number;
  celebrationsNext: { day: string; name: string; kind: string }[];
};

/** Päättyneen viikon yhteenveto: mitä kaatui, mitä jäi, potti, viikon sankari ja lupaukset. */
export function weekRecap(b: Battle, w: number): WeekRecap | null {
  // Kauden jälkeen myös viimeinen viikko on valmis.
  if (!b.ledgerInput || w < 1 || w > BOSS_WEEK || (w >= b.week && seasonWeek(b.today) <= BOSS_WEEK)) return null;
  const before = w > 1 ? computeLedger(b.ledgerInput, w - 1) : null;
  const after = computeLedger(b.ledgerInput, w);
  const nameOf = (week: number) => b.monsters.get(week)?.name ?? (week === BOSS_WEEK ? 'Loppupomo' : `Viikon ${week} monsteri`);
  const killedBefore = new Set((before?.killed ?? []).map((k) => k.week));

  const hits = b.hits.filter((h) => seasonWeek(h.trained_on) === w);
  const steps = b.steps.filter((s) => seasonWeek(s.day) === w);
  const patrols = b.patrols.filter((p) => seasonWeek(p.day) === w);
  const hitDamage = hits.reduce((a, h) => a + h.damage, 0);
  const bonusDamage = hits.reduce((a, h) => a + (h.damage - Math.round(h.damage / (1 + (h.bonus_pct ?? 0) / 100))), 0);
  const damage = hitDamage + steps.length * STEP_DAY_DAMAGE + patrols.length * PATROL_DAY_DAMAGE;

  const totals = new Map<string, number>();
  for (const h of hits) totals.set(h.user_id, (totals.get(h.user_id) ?? 0) + h.damage);
  for (const s of steps) totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + STEP_DAY_DAMAGE);
  const top = [...totals].sort((a, c) => c[1] - a[1])[0];

  const weekEnd = weekRange(w).end;
  return {
    week: w,
    killed: after.killed.filter((k) => !killedBefore.has(k.week)).map((k) => nameOf(k.week)),
    survived: after.alive.map((f) => ({ name: nameOf(f.week), hp: f.hp })),
    damage,
    bonusShare: damage ? Math.round((bonusDamage / damage) * 100) : 0,
    potGain: after.pot - (before?.pot ?? 0),
    pot: after.pot,
    lostToSeal: after.lostToSeal - (before?.lostToSeal ?? 0),
    mvp: top ? { name: b.heroes.find((h) => h.id === top[0])?.hero_name ?? '', damage: top[1] } : null,
    pledgesKept: b.ledgerInput.pledgeBonusesByWeek[w] ?? 0,
    participants: b.participants.length,
    patrolDays: patrols.length,
    stepDays: steps.length,
    jointTrainings: hits.filter((h) => h.companions.length >= 2).length,
    celebrationsNext: upcomingCelebrations({ ...b, today: addDays(weekEnd, 1) } as Battle, 7),
  };
}

/** Raportti tekstinä WhatsAppiin. */
export function recapText(r: WeekRecap) {
  const fmt = (n: number) => n.toLocaleString('fi-FI');
  const lines = [`⚔️ MONSTERIJAHTI – viikko ${r.week}`, ''];
  if (r.killed.length) lines.push(`💀 Kaatui: ${r.killed.join(', ')}`);
  for (const s of r.survived) lines.push(`😈 Jäi henkiin: ${s.name} (${fmt(s.hp)} HP rästiin)`);
  lines.push(`💥 Voimaa yhteensä ${fmt(r.damage)} (bonusten osuus ${r.bonusShare} %)`);
  if (r.lostToSeal) lines.push(`🛡️ Sinetti jäi vajaaksi: ${fmt(r.lostToSeal)} padottua voimaa menetettiin`);
  lines.push(`💰 Potti +${fmt(r.potGain)} → ${fmt(r.pot)}`);
  if (r.mvp) lines.push(`🏆 Viikon sankari: ${r.mvp.name} (${fmt(r.mvp.damage)})`);
  lines.push(`🤝 Lupauksen piti ${r.pledgesKept}/${r.participants}`);
  lines.push(`👣 Askelpäiviä ${r.stepDays}, partiopäiviä ${r.patrolDays} · yhteistreenejä ${r.jointTrainings}`);
  if (r.celebrationsNext.length) lines.push(`🎉 Tulossa: ${r.celebrationsNext.map((c) => `${formatDay(c.day)} ${c.name}`).join(', ')}`);
  return lines.join('\n');
}
