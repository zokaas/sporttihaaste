import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { choosesTarget, loadBattle } from './battle';
import { sendOnce } from './push';
import { testDay, today } from './today';
import { addDays, weekRange, BOSS_WEEK, isGateDay, earlyRevealMs } from './season';
import { sealView } from './rules';
import { partStates, weaknessesOf } from './trio';
import { createAdminClient } from './supabase/admin';
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
  await earlyReveal(supabase, b);
}

/**
 * Ennakkopaljastus: kun viikon monsteri ja kaikki rästit ovat kaatuneet, seuraava monsteri (myös loppupomo)
 * paljastuu aikaisintaan viikon sunnuntaina klo 19. Paljastusaika siirretään tietokantaan, joten näkymä
 * monsters_public avaa tiedot itse oikealla hetkellä. Lyöminen alkaa silti vasta maanantaina.
 * Ilmoitus lähtee heti, jos hetki on jo ohi; muuten sunnuntai-illan ajo lähettää sen.
 */
async function earlyReveal(supabase: SupabaseClient, b: Battle) {
  const w = b.week;
  if (!b.ledger || w < 1 || w >= BOSS_WEEK) return;
  if (!b.ledger.killed.some((k) => k.week === w) || b.ledger.alive.some((f) => f.week <= w)) return;
  const admin = createAdminClient();
  if (!admin) return;
  const next = w + 1;
  const now = Date.now();
  const at = Math.max(now, earlyRevealMs(w));
  const { data: m } = await admin.from('monsters').select('name, weakness, parts, revealed_at').eq('week', next).maybeSingle();
  if (!m?.name) return;
  const current = m.revealed_at ? Date.parse(m.revealed_at) : Infinity;
  if (current > at) {
    const { error } = await admin.from('monsters').update({ revealed_at: new Date(at).toISOString() }).eq('week', next);
    if (error) throw error;
  }
  if (Math.min(current, at) > now) return;
  const weak = weaknessesOf(m as Parameters<typeof weaknessesOf>[0]);
  await sendOnce(supabase, `early-${next}`, {
    title: next === BOSS_WEEK ? `🔥 Loppupomo paljastui: ${m.name}` : `👁️ Seuraava monsteri paljastui: ${m.name}`,
    body: `Herää ma klo 00.00.${weak.length ? ` ${weak.length > 1 ? 'Heikkoudet' : 'Heikkous'}: ${weak.join(', ')}.` : ''} Siihen asti iskut säästyvät ensi-iskuun.`,
  });
}

/**
 * Kaksikon tai kolmikon osan kaatuminen: ilmoitus kaikille kerran per osa, mukana kaatumisrepliikki.
 * Vain elossa olevat monsterit (koko monsterin kaatumisesta tulee oma ilmoitus).
 */
async function notifyPartFalls(supabase: SupabaseClient, b: Battle) {
  for (const f of b.ledger?.alive ?? []) {
    const m = b.monsters.get(f.week);
    if (!m?.parts?.length || !m.hp) continue;
    // Kohteen valinnassa osat kaatuvat missä järjestyksessä tahansa: tila tulee taistelukirjanpidosta.
    const choose = choosesTarget(m) && f.parts;
    const dead = choose ? f.parts!.map((x) => x.dead) : partStates(m.hp, sealView(f, b.required).hp, m.parts.length, false).map((x) => x.dead);
    for (let i = 0; i < m.parts.length; i++) {
      if (!dead[i] || (!choose && i === m.parts.length - 1)) continue;
      const line = !choose || !dead[i + 1] ? fallLine(m.parts, i) : null;
      const rest = m.parts.filter((_, j) => !dead[j]).map((p) => p.name).join(' ja ');
      if (!rest) continue;
      await sendOnce(supabase, `part-${f.week}-${i}`, {
        title: `💥 ${m.parts[i].name} kaatui!`,
        body: line ? `${line.who}: ”${line.text}”` : `${rest} ${m.parts.filter((_, j) => !dead[j]).length > 1 ? 'jatkavat' : 'jatkaa'} vielä taistelua.`,
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
