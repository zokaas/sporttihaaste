// Kauden puolivälin raportti: viikot 1–6 yhteensä. Näkyy, kun viikko 6 on lukittu (ma 9.11. klo 12).
import { computeLedger, STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE } from './rules';
import { seasonWeek, weekRange, BOSS_WEEK } from './season';
import type { Battle } from './stats';

export const MID_WEEK = 6;

/** Onko puolivälin raportti valmis (viikko 6 päättynyt ja armonaika ohi). */
export const midseasonReady = (b: Battle) => b.week > MID_WEEK && !(b.grace && b.grace <= MID_WEEK);

export function midseason(b: Battle) {
  if (!b.ledgerInput || !midseasonReady(b)) return null;
  const inHalf = (d: string) => { const w = seasonWeek(d); return w >= 1 && w <= MID_WEEK; };
  const ledger = computeLedger(b.ledgerInput, MID_WEEK);
  const nameOf = (w: number) => b.monsters.get(w)?.name ?? `Viikon ${w} monsteri`;
  const hits = b.hits.filter((h) => inHalf(h.trained_on));
  const steps = b.steps.filter((s) => inHalf(s.day));
  const patrols = b.patrols.filter((p) => inHalf(p.day));
  const kela = b.kela.filter((k) => inHalf(k.day)).reduce((a, k) => a + k.damage, 0);
  const damage = hits.reduce((a, h) => a + h.damage, 0) + steps.length * STEP_DAY_DAMAGE + patrols.length * PATROL_DAY_DAMAGE + kela;

  const per = new Map<string, number>();
  for (const h of hits) per.set(h.user_id, (per.get(h.user_id) ?? 0) + h.damage);
  for (const s of steps) per.set(s.user_id, (per.get(s.user_id) ?? 0) + STEP_DAY_DAMAGE);
  const heroName = (id: string) => b.heroes.find((h) => h.id === id)?.hero_name ?? '?';
  const top = [...per].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([id, n]) => ({ name: heroName(id), damage: n }));

  const stepBy = new Map<string, number>();
  for (const s of steps) stepBy.set(s.user_id, (stepBy.get(s.user_id) ?? 0) + 1);
  const stepKing = [...stepBy].sort((a, c) => c[1] - a[1])[0];

  let kept = 0;
  for (let w = 1; w <= MID_WEEK; w++) kept += b.ledgerInput.pledgeBonusesByWeek[w] ?? 0;

  const killedWeeks = new Set(ledger.killed.filter((k) => k.week <= MID_WEEK).map((k) => k.week));
  return {
    end: weekRange(MID_WEEK).end,
    killed: [...killedWeeks].sort((a, c) => a - c).map(nameOf),
    survived: ledger.alive.filter((f) => f.week <= MID_WEEK).map((f) => ({ name: nameOf(f.week), hp: f.hp })),
    monsters: MID_WEEK,
    damage,
    trainings: hits.length,
    stepDays: steps.length,
    patrols: patrols.length,
    jointTrainings: hits.filter((h) => h.companions.length >= 2).length,
    pledgesKept: kept,
    pledgesTotal: b.participants.length * MID_WEEK,
    pot: ledger.pot,
    top,
    stepKing: stepKing ? { name: heroName(stepKing[0]), days: stepKing[1] } : null,
    weeksLeft: BOSS_WEEK - MID_WEEK,
  };
}

export type Midseason = NonNullable<ReturnType<typeof midseason>>;

/** Raportti tekstinä WhatsAppiin. */
export function midseasonText(m: Midseason) {
  const fmt = (n: number) => n.toLocaleString('fi-FI');
  const lines = ['⚔️ MONSTERIJAHTI – kausi puolivälissä', ''];
  lines.push(`💀 Kaatui ${m.killed.length}/${m.monsters}${m.killed.length ? `: ${m.killed.join(', ')}` : ''}`);
  for (const s of m.survived) lines.push(`😈 Rästissä: ${s.name} (${fmt(s.hp)} HP)`);
  lines.push(`💥 Voimaa yhteensä ${fmt(m.damage)} · ${m.trainings} treeniä · ${m.stepDays} askelpäivää${m.patrols ? ` · ${m.patrols} megamarssia` : ''}`);
  lines.push(`🤝 Lupauksia pidetty ${m.pledgesKept}/${m.pledgesTotal}`);
  if (m.jointTrainings) lines.push(`👥 Yhteistreenejä ${m.jointTrainings}`);
  if (m.top.length) lines.push(`🏆 Kärki: ${m.top.map((t, i) => `${i + 1}. ${t.name} (${fmt(t.damage)})`).join(', ')}`);
  if (m.stepKing) lines.push(`👣 Askelkuningas: ${m.stepKing.name} (${m.stepKing.days} päivää)`);
  lines.push(`⚔️ Ensi-isku loppupomolle: ${fmt(m.pot)}`);
  lines.push('', `${m.weeksLeft} viikkoa jäljellä. Loppupomo odottaa.`);
  return lines.join('\n');
}
