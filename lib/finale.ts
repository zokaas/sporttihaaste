// Kauden loppugaala: lopputulos, pokaalikaappi, kauden luvut, kunniamerkit ja oma kausi.
import type { Battle } from './stats';
import { finalBlows, heroStats } from './stats';
import { BOSS_WEEK, seasonWeek } from './season';

export type FinaleHero = { id: string; name: string; avatar: string | null };
export type Award = { icon: string; title: string; detail: string; winners: FinaleHero[]; value: number; unit: string };

const fmt = (n: number) => n.toLocaleString('fi-FI');

/** Palkinnon voittajat: kaikki, joilla on suurin arvo (tasapeli jaetaan). Ei voittajaa, jos kaikilla on nolla. */
function top(heroes: FinaleHero[], value: (id: string) => number) {
  const best = Math.max(0, ...heroes.map((h) => value(h.id)));
  return { best, winners: best > 0 ? heroes.filter((h) => value(h.id) === best) : [] };
}

export function seasonFinale(b: Battle, userId: string, avatarUrl: (p: string | null) => string | null, imageUrl: (p: string | null | undefined) => string | null) {
  const stats = heroStats(b, avatarUrl);
  const heroes: FinaleHero[] = stats.map((s) => ({ id: s.id, name: s.name, avatar: s.avatar }));
  const byId = new Map(stats.map((s) => [s.id, s]));
  const killed = new Set((b.ledger?.killed ?? []).map((k) => k.week));
  const closed = seasonWeek(b.today) > BOSS_WEEK ? BOSS_WEEK : b.week - 1;

  // Pokaalikaappi: kaikki monsterit ja loppupomo
  const monsters = Array.from({ length: BOSS_WEEK }, (_, i) => {
    const w = i + 1;
    const m = b.monsters.get(w);
    return { week: w, name: m?.name ?? (w === BOSS_WEEK ? 'Loppupomo' : `Viikon ${w} monsteri`), image: imageUrl(m?.image_path), killed: killed.has(w) };
  });

  // Palkintojen laskenta
  const blows = finalBlows(b);
  const blowCount = new Map<string, number>();
  for (const id of Object.values(blows)) blowCount.set(id, (blowCount.get(id) ?? 0) + 1);

  const kept = new Map<string, number>();
  for (const h of heroes) {
    let n = 0;
    for (let w = 1; w <= closed; w++) if (b.pledgeStatus(h.id, w).kept) n++;
    kept.set(h.id, n);
  }

  // Yhteistreenipäivät: kirjaaja ja merkityt seuralaiset, kukin päivä kerran
  const together = new Set<string>();
  for (const h of b.hits) if (h.companions.length) for (const id of [h.user_id, ...h.companions]) together.add(`${id}|${h.trained_on}`);
  const togetherCount = (id: string) => [...together].filter((k) => k.startsWith(`${id}|`)).length;

  // Heikkousosumat: iskut, jotka oikeasti saivat heikkousbonuksen (tallennettu iskuun kirjaushetkellä).
  const weaknessHits = new Map<string, number>();
  for (const h of b.hits) if (h.weakness_hit) weaknessHits.set(h.user_id, (weaknessHits.get(h.user_id) ?? 0) + 1);

  const defs: { icon: string; title: string; detail: string; unit: string; value: (id: string) => number }[] = [
    { icon: '🏆', title: 'MVP', detail: 'Eniten voimaa koko kaudella', unit: 'voimaa', value: (id) => byId.get(id)?.damage ?? 0 },
    { icon: '💥', title: 'Kovin isku', detail: 'Kauden suurin yksittäinen isku', unit: 'voimaa', value: (id) => Math.max(0, ...b.hits.filter((h) => h.user_id === id).map((h) => h.damage)) },
    { icon: '⚔️', title: 'Viimeisten iskujen mestari', detail: 'Eniten monsterien viimeisiä iskuja', unit: 'viimeistä iskua', value: (id) => blowCount.get(id) ?? 0 },
    { icon: '🤝', title: 'Lupauksen pitäjä', detail: 'Eniten pidettyjä viikkolupauksia', unit: `/ ${closed} lupausta`, value: (id) => kept.get(id) ?? 0 },
    { icon: '👣', title: 'Askelkuningas', detail: 'Eniten 10 000 askeleen päiviä', unit: 'askelpäivää', value: (id) => byId.get(id)?.stepDays ?? 0 },
    { icon: '👥', title: 'Porukan liima', detail: 'Eniten yhteistreenipäiviä', unit: 'yhteistreenipäivää', value: togetherCount },
    { icon: '🎯', title: 'Heikkousmetsästäjä', detail: 'Eniten iskuja monsterin heikkouteen', unit: 'heikkousiskua', value: (id) => weaknessHits.get(id) ?? 0 },
  ];
  const awards: Award[] = defs
    .map((d) => {
      const t = top(heroes, d.value);
      return { icon: d.icon, title: d.title, detail: d.detail, unit: d.unit, winners: t.winners, value: t.best };
    })
    .filter((a) => a.winners.length);

  // Kauden luvut
  const streakBest = top(heroes, (id) => byId.get(id)?.longestStreak ?? 0);
  const numbers = [
    { label: 'Voimaa yhteensä', value: fmt(stats.reduce((a, s) => a + s.damage, 0) + b.patrols.length * 250) },
    { label: 'Treenitunteja', value: fmt(Math.round(stats.reduce((a, s) => a + s.hours, 0))) },
    { label: 'Iskuja', value: fmt(b.hits.length) },
    { label: 'Askelpäiviä', value: fmt(b.steps.length) },
    { label: 'Megamarsseja', value: fmt(b.patrols.length) },
    { label: 'Yhteistreenejä', value: fmt(b.hits.filter((h) => h.companions.length >= 2).length) },
    { label: 'Lupauksia pidetty', value: `${[...kept.values()].reduce((a, n) => a + n, 0)}/${closed * heroes.length}` },
    { label: 'Pisin askelputki', value: streakBest.best ? `${streakBest.best} pv` : '–', note: streakBest.winners.map((w) => w.name).join(', ') },
  ];

  // Oma kausi
  const ranked = [...stats].sort((a, c) => c.damage - a.damage);
  const mine = byId.get(userId);
  const ownHits = b.hits.filter((h) => h.user_id === userId);
  const best = ownHits.reduce<(typeof ownHits)[number] | null>((a, h) => (!a || h.damage > a.damage ? h : a), null);
  const own = mine
    ? {
        damage: mine.damage,
        rank: ranked.findIndex((s) => s.id === userId) + 1,
        of: ranked.length,
        hours: mine.hours,
        kept: kept.get(userId) ?? 0,
        closed,
        stepDays: mine.stepDays,
        bestHit: best ? { sport: best.sport, minutes: best.minutes, damage: best.damage } : null,
        awards: awards.filter((a) => a.winners.some((w) => w.id === userId)).map((a) => `${a.icon} ${a.title}`),
        // Kauden aikana ansaitut pysyvät merkit (ei hetkellisiä 🔥 / 🏆).
        badges: mine.achievements.filter((a) => !a.live),
      }
    : null;

  const regularKilled = monsters.filter((m) => m.week < BOSS_WEEK && m.killed).length;
  const bossDown = killed.has(BOSS_WEEK);
  const shareText = [
    `🏁 Monsterijahti 2026 päättyi!`,
    bossDown ? `💀 Loppupomo ${monsters[BOSS_WEEK - 1].name} kaatui!` : `😈 Loppupomo ${monsters[BOSS_WEEK - 1].name} selvisi tällä kertaa.`,
    `Kaadoimme ${regularKilled}/${BOSS_WEEK - 1} monsteria.`,
    ...numbers.slice(0, 5).map((n) => `${n.label}: ${n.value}`),
    '',
    ...awards.map((a) => `${a.icon} ${a.title}: ${a.winners.map((w) => w.name).join(' & ')} (${fmt(a.value)} ${a.unit})`),
  ].join('\n');

  return { bossDown, regularKilled, regularTotal: BOSS_WEEK - 1, boss: monsters[BOSS_WEEK - 1], monsters, numbers, awards, own, shareText };
}

export type Finale = ReturnType<typeof seasonFinale>;
