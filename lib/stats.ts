import type { loadBattle } from './battle';
import { hoursInWeek } from './battle';
import { STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE, computeLedger, potParts } from './rules';
import { addDays, monthDay, seasonWeek, weekRange, BOSS_WEEK } from './season';

export type Battle = Awaited<ReturnType<typeof loadBattle>>;

/** Merkki. `short` näkyy sankarilistassa (esim. "👣14"); `live` = käynnissä oleva putki tai viikon merkki. */
export type Achievement = { icon: string; title: string; detail: string; short?: string; live?: boolean };

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

/** Käynnissä oleva askelputki: päättyy tänään tai eilen (tämän päivän kuittaus voi vielä puuttua). */
function currentStreak(days: string[], today: string) {
  const set = new Set(days);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

/** Korkein saavutettu taso (kynnysarvot nousevassa järjestyksessä), tai 0. */
const tierOf = (value: number, steps: number[]) => [...steps].reverse().find((t) => value >= t) ?? 0;

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

    // Merkit. Pysyvät merkit ansaitaan kerran koko kaudeksi (tasot nousevat); viikon sankari näkyy vain
    // seuraavan viikon ajan, ja 🔥 vain niin kauan kuin askelputki on käynnissä.
    const achievements: Achievement[] = [];
    const live = currentStreak(steps, b.today);
    if (live >= 3) achievements.push({ icon: '🔥', short: `🔥${live}`, title: `Askelputki käynnissä: ${live} päivää`, detail: 'Kuittaa askeleet tänäänkin, niin liekki palaa.', live: true });
    if (b.week >= 2 && winners[b.week - 1] === h.id) achievements.push({ icon: '🏆', title: 'Viikon sankari', detail: `Eniten voimaa viikolla ${b.week - 1}`, live: true });

    // Pisin putki peräkkäin pidettyjä lupauksia päättyneiltä viikoilta.
    let keptRun = 0;
    let keptBest = 0;
    for (let w = 1; w < b.week; w++) { keptRun = b.pledgeStatus(h.id, w).kept ? keptRun + 1 : 0; keptBest = Math.max(keptBest, keptRun); }
    const blowCount = Object.values(blows).filter((id) => id === h.id).length;
    const crits = hits.filter((x) => (x.bonus_pct ?? 0) >= 100).length;
    const weak = hits.filter((x) => x.weakness_hit).length;
    const together = new Set(b.hits.filter((x) => x.companions.length && (x.user_id === h.id || x.companions.includes(h.id))).map((x) => x.trained_on)).size;
    const tiered: [string, string, number, number[], (n: number) => string][] = [
      ['🤝', 'Sanansa pitävä', keptBest, [3, 6, 9], (n) => `${n} lupausta pidetty peräkkäin`],
      ['👣', 'Askelputki', streak, [7, 14, 21], (n) => `${n} askelpäivää putkeen`],
      ['⚔️', 'Viimeinen isku', blowCount, [1, 3, 5], (n) => (n === 1 ? 'Kaatoi monsterin' : `Kaatoi ${n} monsteria`)],
      ['💥', 'Kriittinen', crits, [1, 5, 10], (n) => (n === 1 ? 'Isku vähintään +100 % bonuksella' : `${n} iskua vähintään +100 % bonuksella`)],
      ['🎯', 'Heikkousmetsästäjä', weak, [5, 10, 20], (n) => `${n} iskua monsterin heikkouteen`],
      ['👥', 'Porukan liima', together, [5, 10, 20], (n) => `${n} yhteistreenipäivää`],
    ];
    for (const [icon, title, value, steps_, detail] of tiered) {
      const t = tierOf(value, steps_);
      if (!t) continue;
      const level = steps_.indexOf(t) + 1;
      // Lyhenne: putkissa ja määrissä taso näkyy lukuna (👣14, ⚔️×3); ensimmäinen taso pelkkänä merkkinä.
      const short = level === 1 ? icon : icon === '👣' || icon === '🤝' ? `${icon}${t}` : `${icon}×${t}`;
      achievements.push({ icon, short, title: `${title}${steps_.length > 1 ? ` (taso ${level})` : ''}`, detail: detail(value) });
    }

    return {
      id: h.id,
      name: h.hero_name ?? '',
      avatar: avatarUrl(h.avatar_path),
      damage: hits.reduce((a, x) => a + x.damage, 0) + steps.length * STEP_DAY_DAMAGE,
      hitCount: hits.length,
      hours: Array.from({ length: b.week }, (_, i) => hoursInWeek(b.hits, h.id, i + 1, b.sports)).reduce((a, x) => a + x, 0),
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
  /** Voiman erittely: treenit ilman bonuksia, bonukset, askeleet (+ megamarssit) ja Kela. */
  parts: { training: number; bonus: number; steps: number; kela: number };
  potGain: number;
  pot: number;
  lostToSeal: number;
  mvp: { name: string; damage: number } | null;
  pledgesKept: number;
  participants: number;
  /** Viikon kaatuneiden ja henkiin jääneiden monstereiden kuvat (kaksikolla ja kolmikolla osat). */
  images: { path: string; dead: boolean }[];
  /** Viikon ensi-iskukertymän erittely. */
  potFrom: { label: string; value: number }[];
  /** Lupauksensa pitäneet nimeltä. */
  pledgeKeepers: string[];
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
  const kela = b.kela.filter((k) => seasonWeek(k.day) === w).reduce((a, k) => a + k.damage, 0);
  const damage = hitDamage + steps.length * STEP_DAY_DAMAGE + patrols.length * PATROL_DAY_DAMAGE + kela;

  const totals = new Map<string, number>();
  for (const h of hits) totals.set(h.user_id, (totals.get(h.user_id) ?? 0) + h.damage);
  for (const s of steps) totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + STEP_DAY_DAMAGE);
  const top = [...totals].sort((a, c) => c[1] - a[1])[0];

  const weekEnd = weekRange(w).end;
  const killedWeeks = after.killed.filter((k) => !killedBefore.has(k.week)).map((k) => k.week);
  const imagesOf = (week: number, dead: boolean) => {
    const m = b.monsters.get(week);
    const paths = m?.parts?.length ? m.parts.map((p) => p.image_path) : [m?.image_path];
    return paths.filter((x): x is string => Boolean(x)).map((path) => ({ path, dead }));
  };
  return {
    week: w,
    killed: killedWeeks.map(nameOf),
    images: [...killedWeeks.flatMap((wk) => imagesOf(wk, true)), ...after.alive.flatMap((f) => imagesOf(f.week, false))],
    survived: after.alive.map((f) => ({ name: nameOf(f.week), hp: f.hp })),
    damage,
    // Bonukset prosentteina treenien perusvoiman päälle (sama luku kuin ylläpidon HP-laskurissa).
    bonusShare: hitDamage - bonusDamage ? Math.round((bonusDamage / (hitDamage - bonusDamage)) * 100) : 0,
    // Voiman erittely: treenit ilman bonuksia, bonukset, askeleet (+ megamarssit) ja Kela.
    parts: { training: hitDamage - bonusDamage, bonus: bonusDamage, steps: steps.length * STEP_DAY_DAMAGE + patrols.length * PATROL_DAY_DAMAGE, kela },
    potGain: after.pot - (before?.pot ?? 0),
    potFrom: potParts(after.pot - (before?.pot ?? 0), w === 1 ? b.ledgerInput.startPot ?? 0 : 0, b.ledgerInput.pledgeBonusesByWeek[w] ?? 0),
    pot: after.pot,
    lostToSeal: after.lostToSeal - (before?.lostToSeal ?? 0),
    mvp: top ? { name: b.heroes.find((h) => h.id === top[0])?.hero_name ?? '', damage: top[1] } : null,
    pledgesKept: b.ledgerInput.pledgeBonusesByWeek[w] ?? 0,
    participants: b.participants.length,
    pledgeKeepers: b.participants.filter((u) => b.pledgeStatus(u, w).kept).map((u) => b.heroes.find((h) => h.id === u)?.hero_name ?? '?'),
    patrolDays: patrols.length,
    stepDays: steps.length,
    jointTrainings: hits.filter((h) => h.companions.length >= 2).length,
    celebrationsNext: upcomingCelebrations({ ...b, today: addDays(weekEnd, 1) } as Battle, 7),
  };
}

/** Voiman erittely tekstinä, nollat pois: ["treenit 2 376", "bonukset 540", …]. */
export function powerParts(r: Pick<WeekRecap, 'parts'>) {
  const fmt = (n: number) => n.toLocaleString('fi-FI');
  return ([['treenit', r.parts.training], ['bonukset', r.parts.bonus], ['askeleet', r.parts.steps], ['Kela', r.parts.kela]] as const)
    .filter(([, v]) => v > 0).map(([k, v]) => `${k} ${fmt(v)}`);
}

/** Raportti tekstinä WhatsAppiin. */
export function recapText(r: WeekRecap) {
  const fmt = (n: number) => n.toLocaleString('fi-FI');
  const lines = [`⚔️ MONSTERIJAHTI – viikko ${r.week}`, ''];
  if (r.killed.length) lines.push(`💀 Kaatui: ${r.killed.join(', ')}`);
  for (const s of r.survived) lines.push(`😈 Jäi henkiin: ${s.name} (${fmt(s.hp)} HP rästiin)`);
  lines.push(`💥 Voimaa ${fmt(r.damage)} = ${powerParts(r).join(' + ')}`);
  if (r.lostToSeal) lines.push(`🛡️ Sinetti jäi vajaaksi: ${fmt(r.lostToSeal)} voimaa sinettirajan yli menetettiin`);
  lines.push(`⚔️ Ensi-isku loppupomolle +${fmt(r.potGain)} → ${fmt(r.pot)}${r.potFrom.length > 1 ? ` (${r.potFrom.map((x) => `${x.label.toLowerCase()} ${fmt(x.value)}`).join(', ')})` : ''}`);
  if (r.mvp) lines.push(`🏆 Viikon sankari: ${r.mvp.name} (${fmt(r.mvp.damage)})`);
  lines.push(`🤝 Lupauksen piti ${r.pledgesKept}/${r.participants}${r.pledgeKeepers.length ? `: ${r.pledgeKeepers.join(', ')}` : ''}`);
  return lines.join('\n');
}
