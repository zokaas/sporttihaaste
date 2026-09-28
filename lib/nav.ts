import 'server-only';
import { createClient } from './supabase/server';
import { today } from './today';
import { BOSS_WEEK, seasonWeek } from './season';

export type NavMode = 'auto' | 'on' | 'off';

/** Alapalkin Lyö- ja Bestiaario-kohtien näkyvyys ylläpidon asetuksen mukaan (auto = kauden aikana). */
export async function navVisibility() {
  const supabase = createClient();
  const day = today();
  const week = seasonWeek(day);
  const inSeason = week >= 1 && week <= BOSS_WEEK;
  const [{ data }, { data: auth }] = await Promise.all([
    supabase.from('season').select('nav_strike, nav_bestiary').eq('id', 1).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  // Lyö-valikon askelkuittaus: onko tämä päivä jo kuitattu.
  const { data: stepRow } = inSeason && auth.user
    ? await supabase.from('step_days').select('day').eq('user_id', auth.user.id).eq('day', day).maybeSingle()
    : { data: null };
  const pick = (mode: NavMode | undefined, auto: boolean) => (mode === 'on' ? true : mode === 'off' ? false : auto);
  return {
    strike: pick(data?.nav_strike as NavMode | undefined, week >= 1 && week <= BOSS_WEEK),
    bestiary: pick(data?.nav_bestiary as NavMode | undefined, week >= 1),
    /** Loppupomon viikolla koko sovellus on sen valtakuntaa. */
    bossRealm: week === BOSS_WEEK,
    stepDay: inSeason ? day : null,
    stepped: Boolean(stepRow),
  };
}
