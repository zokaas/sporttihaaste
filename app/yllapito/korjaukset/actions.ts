'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { PREVIEW_ERROR, previewOnly, today } from '@/lib/today';
import { addDays, SEASON_START } from '@/lib/season';
import { checkKills } from '@/lib/events';

type Result = { ok: true } | { ok: false; error: string };

async function admin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  return me?.is_admin ? supabase : null;
}

function done(error: { message: string } | null): Result {
  if (error) return { ok: false, error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function adminDeleteHit(id: number): Promise<Result> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const supabase = await admin();
  if (!supabase) return { ok: false, error: 'Vain ylläpitäjä.' };
  // Treenikuva (migraatio 028) poistetaan iskun mukana.
  const { data } = await supabase.from('hits').select('photo_path').eq('id', id).maybeSingle().then((r) => r, () => ({ data: null }));
  const photo = (data as { photo_path?: string | null } | null)?.photo_path;
  const { error } = await supabase.from('hits').delete().eq('id', id);
  if (!error && photo) await supabase.storage.from('hit-photos').remove([photo]).catch(() => {});
  return done(error);
}

export async function adminSetSick(userId: string, startsOn: string, endsOn: string | null): Promise<Result> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const supabase = await admin();
  if (!supabase) return { ok: false, error: 'Vain ylläpitäjä.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || (endsOn && (!/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || endsOn < startsOn))) return { ok: false, error: 'Tarkista päivämäärät.' };
  // Päällekkäiset jaksot sotkisivat laskennan (sama päivä kahdesti): ne pitää ensin poistaa tai lyhentää.
  const { data: existing } = await supabase.from('sick_periods').select('starts_on, ends_on').eq('user_id', userId);
  if ((existing ?? []).some((x) => x.starts_on <= (endsOn ?? '9999-12-31') && (x.ends_on === null || x.ends_on >= startsOn))) {
    return { ok: false, error: 'Sankarilla on jo sairausjakso näille päiville. Muokkaa viikkonäkymästä tai poista vanha jakso ensin.' };
  }
  // Kipeänä ei treenata: ajanjakson treenit (kuvineen) poistuvat. Askeleet ohitetaan laskennassa.
  let trained = supabase.from('hits').select('*').eq('user_id', userId).gte('trained_on', startsOn);
  if (endsOn) trained = trained.lte('trained_on', endsOn);
  const { data: hits } = await trained;
  if (hits?.length) {
    const { error } = await supabase.from('hits').delete().in('id', hits.map((x: { id: number }) => x.id));
    if (error) return done(error);
    const photos = hits.map((x: { photo_path?: string | null }) => x.photo_path).filter((x): x is string => Boolean(x));
    if (photos.length) await supabase.storage.from('hit-photos').remove(photos).catch(() => {});
  }
  return done((await supabase.from('sick_periods').insert({ user_id: userId, starts_on: startsOn, ends_on: endsOn })).error);
}

export async function adminDeleteSick(id: number): Promise<Result> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const supabase = await admin();
  if (!supabase) return { ok: false, error: 'Vain ylläpitäjä.' };
  return done((await supabase.from('sick_periods').delete().eq('id', id)).error);
}

/** Ylläpitäjä merkitsee tai poistaa yksittäisen sairaspäivän (myös lukituille viikoille). Sama logiikka kuin sankarin omassa merkinnässä. */
export async function adminToggleSickDay(userId: string, day: string, sick: boolean): Promise<Result> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const supabase = await admin();
  if (!supabase) return { ok: false, error: 'Vain ylläpitäjä.' };
  const now = today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < SEASON_START || day > now) return { ok: false, error: 'Päivän pitää olla kauden aikana eikä tulevaisuudessa.' };
  const { data } = await supabase.from('sick_periods').select('id, starts_on, ends_on').eq('user_id', userId);
  const covering = (data ?? []).filter((x) => x.starts_on <= day && (x.ends_on === null || x.ends_on >= day));

  if (sick) {
    if (covering.length) return done(null);
    // Kipeänä ei treenata eikä kävellä: päivän treenit (kuvineen) ja askeleet poistuvat.
    const { data: trained } = await supabase.from('hits').select('*').eq('user_id', userId).eq('trained_on', day);
    if (trained?.length) {
      const { error } = await supabase.from('hits').delete().eq('user_id', userId).eq('trained_on', day);
      if (error) return done(error);
      const photos = trained.map((x: { photo_path?: string | null }) => x.photo_path).filter((x): x is string => Boolean(x));
      if (photos.length) await supabase.storage.from('hit-photos').remove(photos).catch(() => {});
    }
    const { error: stepError } = await supabase.from('step_days').delete().eq('user_id', userId).eq('day', day);
    if (stepError) return done(stepError);
    // Viereiset jaksot yhdistetään, jotta lista pysyy selkeänä.
    const before = (data ?? []).find((x) => x.ends_on === addDays(day, -1));
    const after = (data ?? []).find((x) => x.starts_on === addDays(day, 1));
    let res: Result;
    if (before && after) {
      res = done((await supabase.from('sick_periods').update({ ends_on: after.ends_on }).eq('id', before.id)).error);
      if (res.ok) res = done((await supabase.from('sick_periods').delete().eq('id', after.id)).error);
    } else if (before) res = done((await supabase.from('sick_periods').update({ ends_on: day }).eq('id', before.id)).error);
    else if (after) res = done((await supabase.from('sick_periods').update({ starts_on: day }).eq('id', after.id)).error);
    else res = done((await supabase.from('sick_periods').insert({ user_id: userId, starts_on: day, ends_on: day })).error);
    if (res.ok) await checkKills(supabase).catch(() => {});
    return res;
  }

  for (const x of covering) {
    // Päivä poistetaan jaksosta: alkuosa jää ennalleen, loppuosa (myös jatkuva) säilyy omana jaksonaan.
    const restStart = addDays(day, 1);
    const keepRest = x.ends_on === null ? restStart <= now : x.ends_on >= restStart;
    const { error } = x.starts_on === day
      ? await supabase.from('sick_periods').delete().eq('id', x.id)
      : await supabase.from('sick_periods').update({ ends_on: addDays(day, -1) }).eq('id', x.id);
    if (error) return done(error);
    if (keepRest) {
      const { error: e2 } = await supabase.from('sick_periods').insert({ user_id: userId, starts_on: restStart, ends_on: x.ends_on });
      if (e2) return done(e2);
    }
  }
  return done(null);
}

/** Jatkuva sairaus päättyy: viimeinen sairaspäivä on eilen (tänään merkitty pelkkä päivä poistuu). */
export async function adminEndSick(id: number): Promise<Result> {
  if (previewOnly()) return { ok: false, error: PREVIEW_ERROR };
  const supabase = await admin();
  if (!supabase) return { ok: false, error: 'Vain ylläpitäjä.' };
  const { data: p } = await supabase.from('sick_periods').select('starts_on').eq('id', id).maybeSingle();
  if (!p) return { ok: false, error: 'Jaksoa ei löytynyt.' };
  const last = addDays(today(), -1);
  return done(p.starts_on > last
    ? (await supabase.from('sick_periods').delete().eq('id', id)).error
    : (await supabase.from('sick_periods').update({ ends_on: last }).eq('id', id)).error);
}
