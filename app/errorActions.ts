'use server';
import { createClient } from '@/lib/supabase/server';
import { reportError } from '@/lib/errors';

/** Selaimen kaatuminen (virherajat ja käsittelemättömät virheet) virhelokiin. Vain kirjautuneilta. */
export async function reportClientError(message: string, path: string, detail?: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // Tuotannossa palvelinvirheen teksti on aina sama yleisviesti: lyhennetään, tunniste (digest) mukaan.
  const digest = /digest (\S+)/.exec(String(detail ?? ''))?.[1];
  const text = /Server Components render/.test(String(message))
    ? `Sivun lataus kaatui palvelimella${digest ? ` (tunniste ${digest})` : ''}. Syy näkyy samaan aikaan kirjatussa rivissä, jos se tunnistettiin.`
    : String(message).slice(0, 500);
  await reportError('Selain', text, { path: String(path).slice(0, 200), userId: user.id, detail: detail ? String(detail).slice(0, 2000) : null });
}
