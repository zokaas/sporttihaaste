import 'server-only';
import { cache } from 'react';
import { createClient } from './supabase/server';

/**
 * Kirjautunut käyttäjä, tarkistettuna Supabasesta. Välimuistissa pyynnön ajan, joten sivu,
 * alapalkki ja muut osat eivät kukin tee omaa verkkokutsuaan.
 */
export const currentUser = cache(async () => {
  const { data: { user } } = await createClient().auth.getUser();
  return user;
});
