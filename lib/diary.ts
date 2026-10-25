import type { SupabaseClient } from '@supabase/supabase-js';
import { weekRange } from './season';

export type DiaryEntry = { day: string; title: string | null; body: string };

/** Kuluvan viikon päiväkirjamerkinnät tähän päivään asti, uusin ensin (migraatio 036; ilman taulua tyhjä). */
export async function loadDiary(supabase: SupabaseClient, week: number, today: string): Promise<DiaryEntry[]> {
  if (week < 1) return [];
  const { data, error } = await supabase.from('diary').select('day, title, body').gte('day', weekRange(week).start).lte('day', today).order('day', { ascending: false });
  return error ? [] : ((data ?? []) as DiaryEntry[]);
}
