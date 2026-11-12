import 'server-only';
import { createAdminClient } from './supabase/admin';
import { sendOrQueue } from './push';

/** Tunnetut, käyttäjästä tai verkosta johtuvat viat, joista ylläpitoa ei tarvitse herättää. */
const NOISE = /ResizeObserver|^Script error\.?$|NetworkError|Failed to fetch|Load failed|AbortError|The user aborted|cancelled|NEXT_REDIRECT|NEXT_NOT_FOUND/i;

/**
 * Kirjaa virheen virhelokiin (migraatio 037) ja ilmoittaa ylläpitäjille pushilla, enintään kerran tunnissa
 * samasta lähteestä (hiljaisina tunteina aamulla). Ei koskaan heitä: virheen raportointi ei saa kaataa mitään.
 */
export async function reportError(source: string, error: unknown, extra: { path?: string | null; userId?: string | null; detail?: string | null; push?: boolean } = {}) {
  const message = (error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error) ?? String(error)).slice(0, 500);
  console.error(`[${source}]`, error);
  if (NOISE.test(message)) return;
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const detail = extra.detail ?? (error instanceof Error ? error.stack ?? null : null);
    const { error: insertError } = await admin.from('error_log').insert({
      source: source.slice(0, 80),
      message,
      detail: detail ? detail.slice(0, 2000) : null,
      path: extra.path ? extra.path.slice(0, 200) : null,
      user_id: extra.userId ?? null,
    });
    if (insertError) console.error('Virhelokiin ei voitu kirjoittaa (onko migraatio 037 ajettu?)', insertError.message);
    // Ajastukset ilmoittavat ylläpitäjille itse (kerran päivässä): niistä vain lokiin.
    if (extra.push === false) return;
    // Push ylläpitäjille: sama lähde enintään kerran tunnissa (avain varataan suoraan, palvelinavaimella).
    const key = `error-${source}-${new Date().toISOString().slice(0, 13)}`.slice(0, 200);
    const { error: claimed } = await admin.from('notifications_sent').insert({ key });
    if (claimed) return;
    const { data: admins } = await admin.from('profiles').select('id').eq('is_admin', true);
    const ids = (admins ?? []).map((a) => a.id as string);
    if (ids.length) await sendOrQueue(admin, { title: '🚨 Virhe sovelluksessa', body: `${source}: ${message}`.slice(0, 180), url: '/yllapito?osio=nyt#virheet' }, ids);
  } catch (e) {
    console.error('Virheen raportointi epäonnistui', e);
  }
}
