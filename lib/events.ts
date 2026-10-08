import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBattle } from './battle';
import { sendOnce } from './push';
import { testDay, today } from './today';
import { addDays, weekRange, BOSS_WEEK, isGateDay } from './season';
import { sealView } from './rules';
import { partStates } from './trio';
import { fallLine } from './taunts';

type Battle = Awaited<ReturnType<typeof loadBattle>>;

const nameOf = (b: Battle, week: number) => b.monsters.get(week)?.name ?? (week === BOSS_WEEK ? 'Loppupomo' : `Viikon ${week} monsteri`);

/** Iskun jälkeen: kaatuiko monsteri, ja puuttuuko sinetistä enää yksi. Testitilassa ei lähetetä mitään. */
/** Portinvartijan kaatuminen (29.–30.9.): ilmoitus kaikille kerran. */
async function gateKill(supabase: SupabaseClient, b: Awaited<ReturnType<typeof loadBattle>>) {
  if (!isGateDay(today()) || !b.gate.killed) return;
  await sendOnce(supabase, 'gate-kill', { title: `🗝️ ${b.gate.name} kaatui!`, body: 'Portti on auki. Torstaina klo 00.00 ensimmäinen monsteri astuu esiin.' });
}

/**
 * Kaatumisilmoitus kaikille kerran per monsteri. Kaatumisen voi aiheuttaa treeni, askelkuittaus, sairausmerkintä
 * tai aamun Kela-isku (klo 9), joten tarkistus ajetaan niiden kaikkien jälkeen. Viikon raja estää vanhojen
 * kaatumisten ilmoittamisen, ja sendOnce estää tuplat.
 */
async function notifyKills(supabase: SupabaseClient, b: Battle) {
  if (!b.ledger || !b.hpLocked) return;
  for (const k of b.ledger.killed) {
    if (!k.killedAt || k.killedAt < Date.now() - 7 * 24 * 3600_000 || k.killedAt > Date.now()) continue;
    await sendOnce(supabase, `kill-${k.week}`, { title: `💀 ${nameOf(b, k.week)} kaatui!`, body: 'Sinetti täyttyi ja voima riitti. Katso, kuka löi viimeisen iskun.' });
  }
  await notifyPartFalls(supabase, b);
}

/**
 * Kaksikon tai kolmikon osan kaatuminen: ilmoitus kaikille kerran per osa, mukana kaatumisrepliikki.
 * Vain elossa olevat monsterit (koko monsterin kaatumisesta tulee oma ilmoitus).
 */
async function notifyPartFalls(supabase: SupabaseClient, b: Battle) {
  for (const f of b.ledger?.alive ?? []) {
    const m = b.monsters.get(f.week);
    if (!m?.parts?.length || !m.hp) continue;
    const states = partStates(m.hp, sealView(f, b.required).hp, m.parts.length, false);
    for (let i = 0; i < m.parts.length - 1; i++) {
      if (!states[i].dead) continue;
      const line = fallLine(m.parts, i);
      const rest = m.parts.slice(i + 1).map((p) => p.name).join(' ja ');
      await sendOnce(supabase, `part-${f.week}-${i}`, {
        title: `💥 ${m.parts[i].name} kaatui!`,
        body: line ? `${line.who}: ”${line.text}”` : `${rest} ${i + 2 < m.parts.length ? 'jatkavat' : 'jatkaa'} vielä taistelua.`,
      });
    }
  }
}

/** Kaatumisten tarkistus ilman iskua (sairausmerkintä, aamuajastus). */
export async function checkKills(supabase: SupabaseClient, day = today()) {
  if (testDay()) return;
  await notifyKills(supabase, await loadBattle(supabase, day));
}

export async function afterHit(supabase: SupabaseClient) {
  if (testDay()) return;
  const b = await loadBattle(supabase, today());
  await gateKill(supabase, b);
  if (!b.ledger || !b.hpLocked) return;
  await notifyKills(supabase, b);
  const target = b.ledger.alive[0];
  if (!target) return;
  const missing = b.required.filter((id) => !target.hitters.includes(id));
  // "Vain sinä puutut" vasta perjantaista alkaen, kun sinetti tulee näkyviin.
  if (missing.length === 1 && today() >= addDays(weekRange(b.week).end, -2)) {
    await sendOnce(
      supabase,
      `last-${b.week}-${target.week}-${missing[0]}`,
      { title: '⚔️ Vain sinä puutut sinetistä', body: `Kaikki muut ovat jo lyöneet monsteria ${nameOf(b, target.week)}. Yksi treeni, niin se voi kaatua.` },
      missing,
    );
  }
}

/** Askelkuittauksen jälkeen: tuliko päivästä megamarssi. */
export async function afterStep(supabase: SupabaseClient, day: string) {
  if (testDay()) return;
  const b = await loadBattle(supabase, today());
  await gateKill(supabase, b);
  await notifyKills(supabase, b);
  if (!b.hpLocked || !b.patrols.some((p) => p.day === day)) return;
  await sendOnce(supabase, `patrol-${day}`, { title: '⭐ Megamarssi!', body: 'Kaikki terveet kuittasivat askeleensa. +250 voimaa monsterille.' });
}
