import 'server-only';
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isQuietHour } from './quiet';

export type PushPayload = { title: string; body: string; url?: string };

/** Lähettää push-ilmoituksen annetuille sankareille (tai kaikille). Virheet eivät kaada kutsujaa. */
export async function sendPush(supabase: SupabaseClient, payload: PushPayload, userIds: string[] | null = null) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) return 0;
  if (userIds && userIds.length === 0) return 0;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const { data } = await supabase.rpc('push_targets', { ids: userIds });
  let targets = (data ?? []) as { endpoint: string; p256dh: string; auth: string }[];
  if (targets.length === 0) {
    // Palvelinavaimella (ajastettu muistutus) ei ole käyttäjää, joten funktio ei palauta mitään: luetaan taulu suoraan.
    let q = supabase.from('push_subscriptions').select('endpoint, p256dh, auth');
    if (userIds) q = q.in('user_id', userIds);
    targets = ((await q).data ?? []) as typeof targets;
  }
  const results = await Promise.allSettled(
    targets.map((t) => webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, JSON.stringify({ url: '/', ...payload }))),
  );
  // Vanhentuneet tilaukset (404/410: sovellus poistettu tai ilmoitukset estetty) poistetaan, jotta niihin ei
  // lähetetä turhaan. RLS päästää poistamaan omat tilaukset; ajastettu ajo (palvelinavain) siivoaa kaikki.
  const dead = targets.filter((_, i) => {
    const r = results[i];
    const code = r.status === 'rejected' ? (r.reason as { statusCode?: number })?.statusCode : undefined;
    return code === 404 || code === 410;
  }).map((t) => t.endpoint);
  if (dead.length) await supabase.from('push_subscriptions').delete().in('endpoint', dead).then(() => undefined, () => undefined);
  return results.filter((r) => r.status === 'fulfilled').length;
}

/**
 * Lähettää heti, paitsi hiljaisina tunteina (klo 22–09): silloin ilmoitus menee jonoon ja lähtee
 * aamun ajastuksella klo 9. Jos jonoon ei voi kirjoittaa (migraatio 018 ajamatta), lähetetään heti.
 */
export async function sendOrQueue(supabase: SupabaseClient, payload: PushPayload, userIds: string[] | null = null) {
  if (isQuietHour()) {
    const { error } = await supabase.from('push_queue').insert({ payload, user_ids: userIds });
    if (!error) return 0;
  }
  return sendPush(supabase, payload, userIds);
}

/** Lähettää ilmoituksen vain, jos samaa avainta ei ole jo lähetetty (hiljaisina tunteina jonoon). */
export async function sendOnce(supabase: SupabaseClient, key: string, payload: PushPayload, userIds: string[] | null = null) {
  const { data: claimed } = await supabase.rpc('claim_notification', { k: key });
  if (!claimed) return 0;
  return sendOrQueue(supabase, payload, userIds);
}
