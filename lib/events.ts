import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBattle } from './battle';
import { sendOnce } from './push';
import { testDay, today } from './today';
import { BOSS_WEEK } from './season';

type Battle = Awaited<ReturnType<typeof loadBattle>>;

const nameOf = (b: Battle, week: number) => b.monsters.get(week)?.name ?? (week === BOSS_WEEK ? 'Loppupomo' : `Viikon ${week} monsteri`);

/** Iskun jälkeen: kaatuiko monsteri, ja puuttuuko sinetistä enää yksi. Testitilassa ei lähetetä mitään. */
export async function afterHit(supabase: SupabaseClient) {
  if (testDay()) return;
  const b = await loadBattle(supabase, today());
  if (!b.ledger || !b.hpLocked) return;
  for (const k of b.ledger.killed) {
    if (!k.killedAt || k.killedAt < Date.now() - 15 * 60_000) continue;
    await sendOnce(supabase, `kill-${k.week}`, { title: `💀 ${nameOf(b, k.week)} kaatui!`, body: 'Sinetti täyttyi ja vahinko riitti. Katso, kuka löi viimeisen iskun.' });
  }
  const target = b.ledger.alive[0];
  if (!target) return;
  const missing = b.required.filter((id) => !target.hitters.includes(id));
  if (missing.length === 1) {
    await sendOnce(
      supabase,
      `last-${b.week}-${target.week}-${missing[0]}`,
      { title: '⚔️ Vain sinä puutut sinetistä', body: `Kaikki muut ovat jo lyöneet monsteria ${nameOf(b, target.week)}. Yksi treeni, niin se voi kaatua.` },
      missing,
    );
  }
}

/** Askelkuittauksen jälkeen: tuliko päivästä partiopäivä. */
export async function afterStep(supabase: SupabaseClient, day: string) {
  if (testDay()) return;
  const b = await loadBattle(supabase, today());
  if (!b.hpLocked || !b.patrols.some((p) => p.day === day)) return;
  await sendOnce(supabase, `patrol-${day}`, { title: '⭐ Partiopäivä!', body: 'Kaikki terveet kuittasivat askeleensa. +250 vahinkoa monsterille.' });
}

/** Viikon monsterin paljastus: ensimmäinen sovelluksen avaus uudella viikolla lähettää ilmoituksen kaikille. */
export async function announceReveal(supabase: SupabaseClient, b: Battle) {
  if (testDay() || !b.hpLocked) return;
  const m = b.monsters.get(b.week);
  if (!m?.name) return;
  await sendOnce(supabase, `reveal-${b.week}`, {
    title: b.week === BOSS_WEEK ? `🔥 Loppupomo heräsi: ${m.name}` : `👁️ Uusi monsteri: ${m.name}`,
    body: m.weakness ? `Heikkous: ${m.weakness} (+50 %). Viikko ${b.week} alkoi.` : `Viikko ${b.week} alkoi.`,
  });
}
