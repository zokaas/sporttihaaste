'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { PREVIEW_ERROR, previewOnly } from '@/lib/today';

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
