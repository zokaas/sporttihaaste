import 'server-only';
import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  return results.filter((r) => r.status === 'fulfilled').length;
}

/** Lähettää ilmoituksen vain, jos samaa avainta ei ole jo lähetetty. */
export async function sendOnce(supabase: SupabaseClient, key: string, payload: PushPayload, userIds: string[] | null = null) {
  const { data: claimed } = await supabase.rpc('claim_notification', { k: key });
  if (!claimed) return 0;
  return sendPush(supabase, payload, userIds);
}
