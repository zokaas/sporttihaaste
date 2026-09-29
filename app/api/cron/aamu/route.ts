import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPush, type PushPayload } from '@/lib/push';
import { fridayReminders } from '@/lib/reminders';
import { helsinkiHour, QUIET_END } from '@/lib/quiet';
import { helsinkiToday, seasonWeek, weekRange, BOSS_WEEK } from '@/lib/season';

export const dynamic = 'force-dynamic';
// Ajastus lukee aina tuoreen tilanteen: Supabase-hakuja ei tallenneta Next.js:n välimuistiin.
export const fetchCache = 'force-no-store';

/**
 * Aamun ilmoitukset klo 9 Suomen aikaa (vercel.json ajaa tämän klo 6 ja 7 UTC, jotta kesä- ja talviaika
 * osuvat kumpikin klo 9:ään; aiemmin kuin klo 9 ei lähetetä mitään, ja kaikki on varattu kerran lähetettäväksi):
 * 1. hiljaisina tunteina (22–09) kirjoitetut viestit
 * 2. yöllä jonoon menneet ilmoitukset (monsteri kaatui, megamarssi, "vain sinä puutut", muistutukset)
 * 3. uuden monsterin paljastus viikon ensimmäisenä päivänä
 * 4. perjantaina jokaisen oma viikkomuistutus
 * Vaatii CRON_SECRET- ja SUPABASE_SERVICE_ROLE_KEY-ympäristömuuttujat.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Ei oikeutta.' }, { status: 401 });
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error('Ajastus: SUPABASE_SERVICE_ROLE_KEY puuttuu Vercelin ympäristömuuttujista.');
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY puuttuu.' }, { status: 500 });
  }
  const hour = helsinkiHour();
  if (hour < QUIET_END) return NextResponse.json({ skipped: `Kello on ${hour}, ilmoitukset lähtevät klo ${QUIET_END}.` });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  const once = async (k: string) => !(await supabase.from('notifications_sent').insert({ key: k })).error;
  const result: Record<string, number | string> = {};

  // 1. Yön viestit
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: queued } = await supabase.from('messages').select('id, body, sender, profiles(hero_name)').is('pushed_at', null).gte('created_at', since).order('created_at');
  const { data: heroes } = await supabase.from('profiles').select('id').not('pledge_locked_at', 'is', null);
  let sent = 0;
  for (const m of (queued ?? []) as unknown as { id: number; body: string; sender: string; profiles: { hero_name: string | null } | null }[]) {
    // Varataan viesti ennen lähetystä, jotta päällekkäinen ajo ei lähetä sitä kahdesti.
    const { data: claimed } = await supabase.from('messages').update({ pushed_at: new Date().toISOString() }).eq('id', m.id).is('pushed_at', null).select('id');
    if (!claimed?.length) continue;
    const others = (heroes ?? []).map((h) => h.id).filter((id) => id !== m.sender);
    sent += await sendPush(supabase, { title: `📣 ${m.profiles?.hero_name ?? 'Sankari'}`, body: m.body, url: '/viestit' }, others);
  }
  result.viestit = sent;

  // 2. Yön jono: poistetaan ennen lähetystä (delete … returning), jotta mitään ei lähetetä kahdesti.
  const { data: night } = await supabase.from('push_queue').delete().lte('created_at', new Date().toISOString()).select('payload, user_ids, created_at');
  let queuedSent = 0;
  for (const q of (night ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at)) as { payload: PushPayload; user_ids: string[] | null }[]) {
    queuedSent += await sendPush(supabase, q.payload, q.user_ids);
  }
  result.jono = queuedSent;

  // 3. Uusi monsteri paljastuu (viikon ensimmäinen päivä: to 1.10. ja sen jälkeen maanantait)
  const day = helsinkiToday();
  const week = seasonWeek(day);
  if (week >= 1 && week <= BOSS_WEEK && weekRange(week).start === day) {
    const { data: m } = await supabase.from('monsters').select('name, weakness').eq('week', week).maybeSingle();
    const { data: season } = await supabase.from('season').select('hp_locked_at').eq('id', 1).maybeSingle();
    if (m?.name && season?.hp_locked_at && (await once(`reveal-${week}`))) {
      result.paljastus = await sendPush(supabase, {
        title: week === BOSS_WEEK ? `🔥 Loppupomo heräsi: ${m.name}` : `👁️ Uusi monsteri: ${m.name}`,
        body: m.weakness ? `Heikkous: ${m.weakness} (+50 %). Viikko ${week} alkoi.` : `Viikko ${week} alkoi.`,
      });
    }
  }

  // 4. Perjantain oma viikkomuistutus
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', weekday: 'short' }).format(new Date());
  if (weekday === 'Fri' && week >= 1 && week <= BOSS_WEEK && (await once(`friday-${week}`))) {
    const r = await fridayReminders(supabase, day);
    result.perjantai = r.sent;
  }

  return NextResponse.json(result);
}
