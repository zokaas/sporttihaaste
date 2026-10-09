'use server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { SPORTS, helsinkiDay, isDay } from '@/lib/garden';

const COOKIE = 'fg_token';

export async function join(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().slice(0, 30);
  if (!name) redirect('/?virhe=nimi');
  const token = randomBytes(18).toString('base64url');
  const { error } = await db().from('fairies').insert({ name, token });
  if (error) redirect('/?virhe=tallennus');
  cookies().set(COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365, path: '/' });
  redirect('/shortcut');
}

export async function logSteps(formData: FormData) {
  const token = cookies().get(COOKIE)?.value;
  const steps = Math.round(Number(formData.get('steps')));
  const dayRaw = formData.get('day');
  const day = isDay(dayRaw) ? dayRaw : helsinkiDay();
  if (!token || !Number.isFinite(steps) || steps < 0 || steps > 200_000) return;
  const supabase = db();
  const { data: fairy } = await supabase.from('fairies').select('id').eq('token', token).maybeSingle();
  if (!fairy) return;
  await supabase.from('steps').upsert({ fairy_id: fairy.id, day, steps, updated_at: new Date().toISOString() });
  revalidatePath('/');
}

export async function logWorkout(formData: FormData) {
  const token = cookies().get(COOKIE)?.value;
  const sport = String(formData.get('sport') ?? '');
  const minutes = Math.round(Number(formData.get('minutes')));
  if (!token || !(SPORTS as readonly string[]).includes(sport) || !(minutes > 0 && minutes <= 600)) return;
  const supabase = db();
  const { data: fairy } = await supabase.from('fairies').select('id').eq('token', token).maybeSingle();
  if (!fairy) return;
  await supabase.from('workouts').insert({ fairy_id: fairy.id, day: helsinkiDay(), sport, minutes });
  revalidatePath('/');
}

export async function leave() {
  cookies().delete(COOKIE);
  redirect('/');
}
