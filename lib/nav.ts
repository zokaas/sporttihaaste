import 'server-only';
import { createClient } from './supabase/server';
import { today } from './today';
import { BOSS_WEEK, seasonWeek } from './season';

export type NavMode = 'auto' | 'on' | 'off';

/** Alapalkin Lyö- ja Bestiaario-kohtien näkyvyys ylläpidon asetuksen mukaan (auto = kauden aikana). */
export async function navVisibility() {
  const { data } = await createClient().from('season').select('nav_strike, nav_bestiary').eq('id', 1).maybeSingle();
  const week = seasonWeek(today());
  const pick = (mode: NavMode | undefined, auto: boolean) => (mode === 'on' ? true : mode === 'off' ? false : auto);
  return {
    strike: pick(data?.nav_strike as NavMode | undefined, week >= 1 && week <= BOSS_WEEK),
    bestiary: pick(data?.nav_bestiary as NavMode | undefined, week >= 1),
  };
}
