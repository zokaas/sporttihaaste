'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { SPORTS, PARTICIPANTS, hitDamage, type Category } from '@/lib/rules';
import { loggableDays, monthDay, seasonWeek } from '@/lib/season';
import { today } from '@/lib/today';
import { monsterOfWeek } from '@/lib/battle';
import { afterHit } from '@/lib/events';

export type HitInput = { day: string; sport: string; minutes: number; companions: string[] };
type Result = { ok: true; damage: number; pct?: number } | { ok: false; error: string };

/** Laskee iskun samoilla säännöillä kuin esikatselu. Käytetään sekä esikatselussa että tallennuksessa. */
async function computeHit(input: HitInput, userId: string) {
  const supabase = createClient();
  const sport = SPORTS.find((s) => s.name === input.sport);
  if (!sport) return { error: 'Valitse laji.' } as const;
  if (!loggableDays(today()).includes(input.day)) return { error: 'Päivälle ei voi enää kirjata. Valitse kuluvan viikon päivä.' } as const;
  if (!Number.isInteger(input.minutes) || input.minutes < 15 || input.minutes > 600) return { error: 'Keston pitää olla 15 min – 10 h.' } as const;

  const [{ data: heroes }, monster] = await Promise.all([
    supabase.from('profiles').select('id, pledge_locked_at, birthday, name_day'),
    monsterOfWeek(supabase, seasonWeek(input.day)),
  ]);
  const ids = new Set((heroes ?? []).filter((h) => h.pledge_locked_at).map((h) => h.id));
  const companions = [...new Set(input.companions)].filter((id) => id !== userId && ids.has(id));
  const md = monthDay(input.day);
  const celebration = (heroes ?? []).some((h) => h.pledge_locked_at && (h.birthday === md || h.name_day === md));
  const groupSize = 1 + companions.length;
  const result = hitDamage({
    minutes: input.minutes,
    sportValue: sport.value,
    category: sport.category,
    groupSize,
    celebration,
    weakness: (monster?.weakness as Category | null) ?? null,
  });
  return { result, companions, allTogether: groupSize >= PARTICIPANTS } as const;
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
  });
  if (error) return { ok: false, error: error.message };
  await afterHit(supabase).catch(() => {});
  revalidatePath('/');
  revalidatePath('/kirjaa');
  return { ok: true, damage: hit.result.damage, pct: hit.result.pct };
}

export async function deleteHit(id: number): Promise<Result> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Kirjaudu ensin.' };
  const { error } = await supabase.from('hits').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  revalidatePath('/kirjaa');
  return { ok: true, damage: 0 };
}
