// Lajilista: ylläpito voi lisätä ja piilottaa lajeja (taulu sports, migraatio 023).
import type { SupabaseClient } from '@supabase/supabase-js';
import { CATEGORIES, SPORTS, type Category, type Sport } from './rules';

export type SportRow = Sport & { active: boolean };

/** Järjestys: lajiryhmä, sitten kauden alun lajit alkuperäisessä järjestyksessä ja lisätyt aakkosjärjestyksessä. */
function sorted(rows: SportRow[]) {
  const seed = new Map(SPORTS.map((s, i) => [s.name, i]));
  return [...rows].sort((a, b) =>
    CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)
    || (seed.get(a.name) ?? 999) - (seed.get(b.name) ?? 999)
    || a.name.localeCompare(b.name, 'fi'));
}

/** Kaikki lajit, myös piilotetut (vanhat iskut tarvitsevat arvon). Ilman taulua käytetään sovelluksen listaa. */
export async function loadSports(supabase: SupabaseClient): Promise<SportRow[]> {
  const { data, error } = await supabase.from('sports').select('name, value, category, active');
  if (error || !data?.length) return SPORTS.map((s) => ({ ...s, active: true }));
  return sorted(data.map((s) => ({ name: s.name as string, value: Number(s.value), category: s.category as Category, active: s.active !== false })));
}

/** Lajit, joille voi kirjata uusia iskuja. */
export const activeSports = (sports: SportRow[]): Sport[] => sports.filter((s) => s.active).map(({ name, value, category }) => ({ name, value, category }));
