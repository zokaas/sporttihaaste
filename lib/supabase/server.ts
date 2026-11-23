import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { skewTolerantFetch } from './skew';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    // Juuri uusittu kirjautuminen voi olla tietokannan kellon mukaan "tulevaisuudessa": uusinta (skew.ts).
    global: { fetch: skewTolerantFetch },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Palvelinkomponentissa evästeitä ei voi asettaa; middleware hoitaa päivityksen.
        }
      },
    },
  });
}
