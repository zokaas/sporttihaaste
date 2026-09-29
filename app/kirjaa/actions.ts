'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { FAMILY_WEAKNESS, hitDamage, type Category } from '@/lib/rules';
import { loadSports } from '@/lib/sports';
import { loggableDays, monthDay, seasonWeek, BOSS_WEEK } from '@/lib/season';
import { today } from '@/lib/today';
import { currentWeaknesses, loadBattle } from '@/lib/battle';
import { afterHit } from '@/lib/events';
import { isSickOn, type SickPeriod } from '@/lib/weekly';

export type HitInput = { day: string; sport: string; minutes: number; companions: string[]; withFamily?: boolean };
type Result = { ok: true; damage: number; pct?: number } | { ok: false; error: string };

/** Laskee iskun samoilla säännöillä kuin esikatselu. Käytetään sekä esikatselussa että tallennuksessa. */
async function computeHit(input: HitInput, userId: string, anyDay = false) {
  const supabase = createClient();
  // Piilotetulle lajille ei voi kirjata uutta iskua, mutta ylläpidon korjaus (anyDay) voi käyttää sitä.
  const sport = (await loadSports(supabase)).find((s) => s.name === input.sport && (s.active || anyDay));
  if (!sport) return { error: 'Valitse laji.' } as const;
  const w = seasonWeek(input.day);
  if (anyDay ? w < 1 || w > BOSS_WEEK || input.day > today() : !loggableDays(today()).includes(input.day)) return { error: 'Päivälle ei voi enää kirjata. Valitse kuluvan viikon päivä.' } as const;
  if (!Number.isInteger(input.minutes) || input.minutes < 15 || input.minutes > 600) return { error: 'Keston pitää olla 15 min – 10 h.' } as const;

  const [{ data: heroes }, battle, { data: sick }] = await Promise.all([
    supabase.from('profiles').select('id, pledge_locked_at, birthday, name_day'),
    loadBattle(supabase, today()),
    supabase.from('sick_periods').select('user_id, starts_on, ends_on'),
  ]);
  const ids = new Set((heroes ?? []).filter((h) => h.pledge_locked_at).map((h) => h.id));
  // Koko porukka = kaikki sinä päivänä terveet ilmoittautuneet.
  const healthy = [...ids].filter((id) => !isSickOn((sick ?? []) as SickPeriod[], id, input.day)).length;
  const companions = [...new Set(input.companions)].filter((id) => id !== userId && ids.has(id));
  const md = monthDay(input.day);
  const celebration = (heroes ?? []).some((h) => h.pledge_locked_at && (h.birthday === md || h.name_day === md));
  const groupSize = 1 + companions.length;
  const weaknesses = currentWeaknesses(battle, seasonWeek(input.day));
  // Mamu/lapsi-merkintä tallennetaan vain, kun se on viikon heikkous.
  const withFamily = Boolean(input.withFamily) && weaknesses.includes(FAMILY_WEAKNESS);
  const result = hitDamage({
    minutes: input.minutes,
    sportValue: sport.value,
    category: sport.category,
    groupSize,
    celebration,
    weakness: weaknesses,
    sport: sport.name,
    withFamily,
    participants: healthy,
  });
  return { result, companions, withFamily, allTogether: healthy >= 2 && groupSize >= healthy } as const;
}

export async function logHit(input: HitInput): Promise<Result> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const hit = await computeHit(input, user.id);
  if ('error' in hit) return { ok: false, error: hit.error! };
  const { error } = await supabase.from('hits').insert({
    user_id: user.id,
    trained_on: input.day,
    sport: input.sport,
    minutes: input.minutes,
    companions: hit.companions,
    base: hit.result.base,
    bonus_pct: hit.result.pct,
    damage: hit.result.damage,
    all_together: hit.allTogether,
    // Sarake tulee migraatiossa 024; lähetetään vain merkittynä, jotta tavallinen kirjaus toimii ilman sitä.
    ...(hit.withFamily ? { with_family: true } : {}),
  });
  if (error) return { ok: false, error: error.message.includes('with_family') ? 'Mamu/lapsi-merkintä vaatii tietokantapäivityksen (migraatio 024). Kerro ylläpidolle.' : error.message };
  await afterHit(supabase).catch(() => {});
  revalidatePath('/', 'layout');
  revalidatePath('/kirjaa');
  return { ok: true, damage: hit.result.damage, pct: hit.result.pct };
}

export async function deleteHit(id: number): Promise<Result> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const { error } = await supabase.from('hits').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  revalidatePath('/kirjaa');
  return { ok: true, damage: 0 };
}

/** Ylläpitäjä kirjaa iskun sankarin puolesta mille tahansa kauden päivälle (korjaukset). */
export async function adminLogHit(input: HitInput & { userId: string }): Promise<Result> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) return { ok: false, error: 'Vain ylläpitäjä.' };
  const hit = await computeHit(input, input.userId, true);
  if ('error' in hit) return { ok: false, error: hit.error! };
  const { error } = await supabase.from('hits').insert({
    user_id: input.userId,
    trained_on: input.day,
    sport: input.sport,
    minutes: input.minutes,
    companions: hit.companions,
    base: hit.result.base,
    bonus_pct: hit.result.pct,
    damage: hit.result.damage,
    all_together: hit.allTogether,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true, damage: hit.result.damage, pct: hit.result.pct };
}
