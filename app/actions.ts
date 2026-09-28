'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { addDays, loggableDays, seasonWeek, BOSS_WEEK } from '@/lib/season';
import { today } from '@/lib/today';
import { afterStep } from '@/lib/events';
import { loadBattle } from '@/lib/battle';
import { sendPush } from '@/lib/push';

type Result = { ok: true } | { ok: false; error: string };

async function me() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function done(error: { message: string } | null): Result {
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Kuittaa tai peruu askelpäivän (+50). */
export async function toggleStep(day: string, on: boolean): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  if (!loggableDays(today()).includes(day)) return { ok: false, error: 'Päivää ei voi enää kuitata.' };
  const { error } = on
    ? await supabase.from('step_days').upsert({ user_id: user.id, day })
    : await supabase.from('step_days').delete().eq('user_id', user.id).eq('day', day);
  if (!error && on) await afterStep(supabase, day).catch(() => {});
  return done(error);
}

/** Merkitsee sairastumisen tälle päivälle tai paranemisen (viimeinen sairaspäivä = eilen). */
export async function setSick(sick: boolean): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const now = today();
  const { data: open } = await supabase.from('sick_periods').select('id, starts_on').eq('user_id', user.id).is('ends_on', null).maybeSingle();
  if (sick) {
    if (open) return { ok: true };
    return done((await supabase.from('sick_periods').insert({ user_id: user.id, starts_on: now })).error);
  }
  if (!open) return { ok: true };
  // Tänään alkanut sairaus perutaan kokonaan, muuten viimeinen sairaspäivä oli eilen.
  const { error } = open.starts_on >= now
    ? await supabase.from('sick_periods').delete().eq('id', open.id)
    : await supabase.from('sick_periods').update({ ends_on: addDays(now, -1) }).eq('id', open.id);
  return done(error);
}

/** Muuttaa lupauksen seuraavasta viikosta alkaen. Kerran viikossa; saman viikon aikana voi vielä korjata. */
export async function changePledge(hours: number): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const next = seasonWeek(today()) + 1;
  if (next < 2 || next > BOSS_WEEK) return { ok: false, error: 'Lupausta ei voi enää muuttaa.' };
  if (!(hours >= 1 && hours <= 15 && Number.isInteger(hours * 2))) return { ok: false, error: 'Lupauksen pitää olla 1–15 h puolen tunnin välein.' };
  return done((await supabase.from('pledge_changes').upsert({ user_id: user.id, from_week: next, hours })).error);
}

/** Muistuttaa sinetistä puuttuvia push-ilmoituksella. Kerran kolmessa tunnissa per lähettäjä. */
export async function nudgeMissing(): Promise<Result & { sent?: number }> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const b = await loadBattle(supabase, today());
  const target = b.ledger?.alive[0];
  if (!target) return { ok: false, error: 'Ei monsteria, jota muistuttaa.' };
  const missing = b.required.filter((id) => !target.hitters.includes(id) && id !== user.id);
  if (!missing.length) return { ok: false, error: 'Kaikki muut ovat jo lyöneet.' };

  const since = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data: recent } = await supabase.from('nudges').select('id').eq('sender', user.id).gte('created_at', since).limit(1);
  if (recent?.length) return { ok: false, error: 'Muistutit jo äskettäin. Voit muistuttaa uudelleen kolmen tunnin päästä.' };
  await supabase.from('nudges').insert({ sender: user.id, week: b.week });

  const sender = b.heroes.find((h) => h.id === user.id)?.hero_name ?? 'Sankari';
  const monster = b.monsters.get(target.week)?.name ?? 'Monsteri';
  const sent = await sendPush(supabase, {
    title: '⏳ Sinetti odottaa sinua',
    body: target.padded
      ? `${sender} muistuttaa: ${monster} on jo nollissa, ${target.padded} vahinkoa odottaa padottuna. Tarvitaan vain sinun iskusi!`
      : `${sender} muistuttaa: ${monster} kaatuu vasta, kun jokainen on lyönyt. Sinun iskusi puuttuu.`,
  }, missing);
  return { ok: true, sent };
}
