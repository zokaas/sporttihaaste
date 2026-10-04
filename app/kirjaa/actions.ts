'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { FAMILY_WEAKNESS, hitDamage, specialOf, type Category } from '@/lib/rules';
import { loadSports } from '@/lib/sports';
import { loggableDays, monthDay, seasonWeek, BOSS_WEEK } from '@/lib/season';
import { PREVIEW_ERROR, previewOnly, today } from '@/lib/today';
import { currentWeaknesses, loadBattle } from '@/lib/battle';
import { afterHit } from '@/lib/events';
import { isSickOn, type SickPeriod } from '@/lib/weekly';

export type HitInput = { day: string; sport: string; minutes: number; companions: string[]; special?: string | null; photo?: string | null };

const PHOTO_BUCKET = 'hit-photos';
/** Treenikuvan polku kelpaa vain kirjaajan omasta kansiosta (käyttäjän id / satunnainen nimi). */
const ownPhoto = (path: string | null | undefined, userId: string) =>
  path && path.startsWith(`${userId}/`) && /^[0-9a-f-]+\/[0-9a-f-]+\.jpg$/.test(path) ? path : null;
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
  if (isSickOn((sick ?? []) as SickPeriod[], userId, input.day)) return { error: 'Päivä on merkitty sairaspäiväksi. Poista sairausmerkintä ensin, jos treenasit.' } as const;
  const ids = new Set((heroes ?? []).filter((h) => h.pledge_locked_at).map((h) => h.id));
  // Koko porukka = kaikki sinä päivänä terveet ilmoittautuneet.
  const healthy = [...ids].filter((id) => !isSickOn((sick ?? []) as SickPeriod[], id, input.day)).length;
  const companions = [...new Set(input.companions)].filter((id) => id !== userId && ids.has(id));
  const md = monthDay(input.day);
  const celebration = (heroes ?? []).some((h) => h.pledge_locked_at && (h.birthday === md || h.name_day === md));
  const groupSize = 1 + companions.length;
  const weaknesses = currentWeaknesses(battle, seasonWeek(input.day));
  // Erikoisheikkouden merkintä hyväksytään vain, kun se on viikon (vuorossa olevan osan) heikkous.
  const special = input.special && input.special === specialOf(weaknesses) ? input.special : null;
  const result = hitDamage({
    minutes: input.minutes,
    sportValue: sport.value,
    category: sport.category,
    groupSize,
    celebration,
    weakness: weaknesses,
    sport: sport.name,
    special,
    participants: healthy,
  });
  return { result, companions, special, weaknessHit: result.bonuses.some((b) => b.label.startsWith('Heikkous')), allTogether: healthy >= 2 && groupSize >= healthy } as const;
}

type Computed = Exclude<Awaited<ReturnType<typeof computeHit>>, { error: string }>;

/**
 * Tallentaa iskun. Uudet sarakkeet lähetetään vain tarvittaessa: with_family (024), weakness_hit (025)
 * ja special (026). Jos migraatio on ajamatta, sarake jätetään pois ja tallennetaan ilman sitä.
 */
async function insertHit(supabase: ReturnType<typeof createClient>, userId: string, input: HitInput, hit: Computed) {
  const row: Record<string, unknown> = {
    user_id: userId,
    trained_on: input.day,
    sport: input.sport,
    minutes: input.minutes,
    companions: hit.companions,
    base: hit.result.base,
    bonus_pct: hit.result.pct,
    damage: hit.result.damage,
    all_together: hit.allTogether,
  };
  const optional: Record<string, unknown> = {
    ...(hit.special === FAMILY_WEAKNESS ? { with_family: true } : {}),
    ...(hit.special ? { special: hit.special } : {}),
    ...(hit.weaknessHit ? { weakness_hit: true } : {}),
    ...(ownPhoto(input.photo, userId) ? { photo_path: input.photo } : {}),
  };
  for (;;) {
    const { error } = await supabase.from('hits').insert({ ...row, ...optional });
    const missing = error && Object.keys(optional).find((k) => error.message.includes(k));
    if (!missing) return error;
    delete optional[missing];
  }
}

export async function logHit(input: HitInput): Promise<Result> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const hit = await computeHit(input, user.id);
  if ('error' in hit) return { ok: false, error: hit.error! };
  const error = await insertHit(supabase, user.id, input, hit);
  if (error) {
    const photo = ownPhoto(input.photo, user.id);
    if (photo) await supabase.storage.from(PHOTO_BUCKET).remove([photo]).catch(() => {});
    return { ok: false, error: error.message };
  }
  await afterHit(supabase).catch(() => {});
  revalidatePath('/', 'layout');
  revalidatePath('/kirjaa');
  return { ok: true, damage: hit.result.damage, pct: hit.result.pct };
}

/** Iskun treenikuvan polku (ennen migraatiota 028 aina null). */
async function hitPhoto(supabase: ReturnType<typeof createClient>, id: number) {
  const { data, error } = await supabase.from('hits').select('photo_path').eq('id', id).maybeSingle();
  return error ? null : ((data as { photo_path?: string | null } | null)?.photo_path ?? null);
}

export async function deleteHit(id: number): Promise<Result> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const photo = await hitPhoto(supabase, id);
  const { error } = await supabase.from('hits').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  if (photo) await supabase.storage.from(PHOTO_BUCKET).remove([photo]).catch(() => {});
  revalidatePath('/', 'layout');
  revalidatePath('/kirjaa');
  return { ok: true, damage: 0 };
}

/** Ylläpitäjä kirjaa iskun sankarin puolesta mille tahansa kauden päivälle (korjaukset). */
export async function adminLogHit(input: HitInput & { userId: string }): Promise<Result> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) return { ok: false, error: 'Vain ylläpitäjä.' };
  const hit = await computeHit(input, input.userId, true);
  if ('error' in hit) return { ok: false, error: hit.error! };
  const error = await insertHit(supabase, input.userId, input, hit);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true, damage: hit.result.damage, pct: hit.result.pct };
}
