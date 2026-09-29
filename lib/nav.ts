import 'server-only';
import { createClient } from './supabase/server';
import { cache } from 'react';
import { today } from './today';
import { currentUser } from './auth';
import { BOSS_WEEK, isGateDay, seasonWeek } from './season';

export type NavMode = 'auto' | 'on' | 'off';

/** Alapalkin Lyö- ja Bestiaario-kohtien näkyvyys ylläpidon asetuksen mukaan (auto = kauden aikana). */
export const navVisibility = cache(async () => {
  const supabase = createClient();
  const day = today();
  const week = seasonWeek(day);
  // Portinvartijan päivinä (29.–30.9.) Lyö ja askelkuittaus ovat jo auki.
  const inSeason = (week >= 1 && week <= BOSS_WEEK) || isGateDay(day);
  // Käyttäjä on yleensä jo haettu sivulla (välimuisti), joten asetukset ja askel haetaan rinnakkain.
  const user = await currentUser();
  const [{ data }, { data: stepRow }] = await Promise.all([
    supabase.from('season').select('nav_strike, nav_bestiary').eq('id', 1).maybeSingle(),
    // Lyö-valikon askelkuittaus: onko tämä päivä jo kuitattu.
    inSeason && user
      ? supabase.from('step_days').select('day').eq('user_id', user.id).eq('day', day).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const pick = (mode: NavMode | undefined, auto: boolean) => (mode === 'on' ? true : mode === 'off' ? false : auto);
  return {
    strike: pick(data?.nav_strike as NavMode | undefined, inSeason),
    bestiary: pick(data?.nav_bestiary as NavMode | undefined, week >= 1),
    /** Loppupomon viikolla koko sovellus on sen valtakuntaa. */
    bossRealm: week === BOSS_WEEK,
    stepDay: inSeason ? day : null,
    stepped: Boolean(stepRow),
  };
});
