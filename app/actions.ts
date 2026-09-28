'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { addDays, loggableDays, seasonWeek, today } from '@/lib/season';

type Result = { ok: true } | { ok: false; error: string };

async function me() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function done(error: { message: string } | null): Result {
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
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
  if (next < 2 || next > 11) return { ok: false, error: 'Lupausta ei voi enää muuttaa.' };
  if (!(hours >= 1 && hours <= 15 && Number.isInteger(hours * 2))) return { ok: false, error: 'Lupauksen pitää olla 1–15 h puolen tunnin välein.' };
  return done((await supabase.from('pledge_changes').upsert({ user_id: user.id, from_week: next, hours })).error);
}
