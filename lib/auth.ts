import 'server-only';
import { cache } from 'react';
import { createClient } from './supabase/server';

/**
 * Kirjautunut käyttäjä sivujen näyttämistä varten. Välimuistissa pyynnön ajan.
 *
 * getClaims tarkistaa kirjautumistokenin allekirjoituksen paikallisesti (Supabasen julkisella avaimella),
 * joten sivun avaaminen ei odota erillistä kierrosta Supabasen kirjautumispalvelimelle. Jos projekti käyttää
 * vielä vanhaa jaettua avainta, getClaims tekee saman tarkistuksen verkon yli. Tietokantahaut tarkistavat
 * tokenin joka tapauksessa (RLS), ja kirjoittavat toiminnot käyttävät edelleen getUseria.
 */
export const currentUser = cache(async (): Promise<{ id: string } | null> => {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!error && typeof sub === 'string') return { id: sub };
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { id: user.id } : null;
});
