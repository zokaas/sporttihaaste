// Kauden puolivälin raportti pe 6.11.: tilanne kauden alusta torstaihin 5.11. asti (luvut eivät enää muutu).
// Ylläpitäjä voi esikatsella sitä milloin tahansa; luvut ovat silloin tähänastiset.
import { STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE } from './rules';
import { addDays, helsinkiMs, seasonWeek, SEASON_END } from './season';
import { heroStats, type Battle } from './stats';

/** Raportin päivä (pe, viikko 6). Ilmoitus lähtee aamulla klo 9. */
export const MID_DAY = '2026-11-06';
/** Etusivun kortti näkyy raportin päivästä viikon 7 loppuun. */
export const MID_CARD_UNTIL = '2026-11-15';

export const midseasonReady = (b: Battle) => b.today >= MID_DAY;

export function midseason(b: Battle, preview = false, userId?: string) {
  if (!b.ledger || (!midseasonReady(b) && !preview)) return null;
  // Luvut torstaihin 5.11. asti; esikatselussa tähänastiset.
  const until = b.today < MID_DAY ? b.today : addDays(MID_DAY, -1);
  const untilMs = helsinkiMs(until) + 1000;
  // Mukana myös portinvartijan päivät (29.–30.9.), kuten sankarien omissa luvuissa.
  const inRange = (d: string) => d <= until;
  const nameOf = (w: number) => b.monsters.get(w)?.name ?? `Viikon ${w} monsteri`;
  const hits = b.hits.filter((h) => inRange(h.trained_on));
  const steps = b.steps.filter((s) => inRange(s.day));
  const patrols = b.patrols.filter((p) => inRange(p.day));
  const kela = b.kela.filter((k) => inRange(k.day)).reduce((a, k) => a + k.damage, 0);
  const damage = hits.reduce((a, h) => a + h.damage, 0) + steps.length * STEP_DAY_DAMAGE + patrols.length * PATROL_DAY_DAMAGE + kela;

  const per = new Map<string, number>();
  for (const h of hits) per.set(h.user_id, (per.get(h.user_id) ?? 0) + h.damage);
  for (const s of steps) per.set(s.user_id, (per.get(s.user_id) ?? 0) + STEP_DAY_DAMAGE);
  const heroName = (id: string) => b.heroes.find((h) => h.id === id)?.hero_name ?? '?';
  const top = [...per].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([id, n]) => ({ name: heroName(id), damage: n }));

  const stepBy = new Map<string, number>();
  for (const s of steps) stepBy.set(s.user_id, (stepBy.get(s.user_id) ?? 0) + 1);
  const stepKing = [...stepBy].sort((a, c) => c[1] - a[1])[0];

  // Pidetyt lupaukset päättyneiltä viikoilta.
  const closed = Math.max(0, seasonWeek(until) - 1);
  let kept = 0;
  for (let w = 1; w <= closed; w++) kept += b.ledgerInput?.pledgeBonusesByWeek[w] ?? 0;

  // Monsterit: kaatuneet raportin rajaan mennessä, ja ne, joiden viikko on jo alkanut mutta jotka ovat vielä pystyssä.
  const killed = b.ledger.killed.filter((k) => k.killedAt != null && k.killedAt < untilMs).map((k) => k.week);
  const started = seasonWeek(until);
  const standing = Array.from({ length: started }, (_, i) => i + 1).filter((w) => !killed.includes(w));
  // Oma puolikausi (Sinun kautesi): samat rajat kuin porukan luvuissa.
  const stats = heroStats(b, () => null);
  const ranking = b.participants.map((id) => ({ id, damage: per.get(id) ?? 0 })).sort((a, c) => c.damage - a.damage);
  const ownHits = userId ? hits.filter((h) => h.user_id === userId) : [];
  const bestHit = ownHits.reduce<(typeof ownHits)[number] | null>((a, h) => (!a || h.damage > a.damage ? h : a), null);
  const own = userId && b.participants.includes(userId)
    ? {
        damage: per.get(userId) ?? 0,
        rank: ranking.findIndex((r) => r.id === userId) + 1,
        of: ranking.length,
        trainings: ownHits.length,
        kept: Array.from({ length: closed }, (_, i) => i + 1).filter((w) => b.pledgeStatus(userId, w).kept).length,
        closed,
        stepDays: stepBy.get(userId) ?? 0,
        bestHit: bestHit ? { sport: bestHit.sport, minutes: bestHit.minutes, damage: bestHit.damage } : null,
        badges: stats.find((s) => s.id === userId)?.achievements.filter((a) => !a.live) ?? [],
      }
    : null;

  return {
    until,
    preview: !midseasonReady(b),
    killed: killed.sort((a, c) => a - c).map(nameOf),
    standing: standing.map((w) => ({ name: nameOf(w), current: w === started })),
    started,
    damage,
    trainings: hits.length,
    stepDays: steps.length,
    patrols: patrols.length,
    jointTrainings: hits.filter((h) => h.companions.length >= 2).length,
    pledgesKept: kept,
    pledgesTotal: b.participants.length * closed,
    pot: b.ledger.pot,
    top,
    stepKing: stepKing ? { name: heroName(stepKing[0]), days: stepKing[1] } : null,
    // Merkit tähän mennessä (pysyvät; hetkelliset 🔥 / 🏆 jätetään pois).
    badges: stats
      .map((s) => ({ name: s.name, shorts: s.achievements.filter((a) => !a.live).map((a) => a.short ?? a.icon) }))
      .filter((x) => x.shorts.length)
      .sort((a, c) => c.shorts.length - a.shorts.length),
    own,
    // Päivät raportin päivästä kauden loppuun (su 20.12.).
    daysLeft: Math.round((Date.parse(SEASON_END) - Date.parse(addDays(until, 1))) / 86_400_000) + 1,
  };
}

export type Midseason = NonNullable<ReturnType<typeof midseason>>;

const dm = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;

/** Raportti tekstinä WhatsAppiin. */
export function midseasonText(m: Midseason) {
  const fmt = (n: number) => n.toLocaleString('fi-FI');
  const lines = [`⚔️ MONSTERIJAHTI – kausi puolivälissä (${dm(m.until)} asti)`, ''];
  lines.push(`💀 Kaatui ${m.killed.length}/${m.started}${m.killed.length ? `: ${m.killed.join(', ')}` : ''}`);
  for (const s of m.standing) lines.push(s.current ? `⚔️ Taistelu käynnissä: ${s.name}` : `😈 Rästissä: ${s.name}`);
  lines.push(`💥 Voimaa yhteensä ${fmt(m.damage)} · ${m.trainings} treeniä · askeleet kuitattu ${m.stepDays} kertaa${m.patrols ? ` · ${m.patrols} megamarssia` : ''}`);
  if (m.pledgesTotal) lines.push(`🤝 Lupauksia pidetty ${m.pledgesKept}/${m.pledgesTotal}`);
  if (m.jointTrainings) lines.push(`👥 Yhteistreenejä ${m.jointTrainings}`);
  if (m.top.length) lines.push(`🏆 Kärki: ${m.top.map((t, i) => `${i + 1}. ${t.name} (${fmt(t.damage)})`).join(', ')}`);
  if (m.stepKing) lines.push(`👣 Askelkuningas: ${m.stepKing.name} (${m.stepKing.days} päivää)`);
  lines.push(`⚔️ Ensi-isku loppupomolle: ${fmt(m.pot)}`);
  lines.push('', `${m.daysLeft} päivää jäljellä. Loppupomo odottaa.`);
  return lines.join('\n');
}
