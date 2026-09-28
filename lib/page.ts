import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { loadBattle } from './battle';
import { today } from './today';

/** Kirjautunut ja ilmoittautunut sankari sekä kauden tilanne. Ohjaa kirjautumiseen tai ilmoittautumiseen tarvittaessa. */
export async function requireHero() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');
  const { data: me } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!me?.hero_name || !me?.pledge_locked_at) redirect('/ilmoittaudu');
  const battle = await loadBattle(supabase, today());
  return { supabase, user, me, battle };
}
