import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { loadBattle } from './battle';
import { today } from './today';
import { currentUser } from './auth';

/** Kirjautunut ja ilmoittautunut sankari sekä kauden tilanne. Ohjaa kirjautumiseen tai ilmoittautumiseen tarvittaessa. */
export async function requireHero() {
  const supabase = createClient();
  const user = await currentUser();
  if (!user) redirect('/kirjaudu');
  // Profiili ja kauden tilanne haetaan rinnakkain, jotta sivu ei odota kahta peräkkäistä kierrosta.
  const [{ data: me }, battle] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    loadBattle(supabase, today()),
  ]);
  if (!me?.hero_name || !me?.pledge_locked_at) redirect('/ilmoittaudu');
  return { supabase, user, me, battle };
}
