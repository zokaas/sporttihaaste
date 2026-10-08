import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPush, type PushPayload } from '@/lib/push';
import { fridayReminders } from '@/lib/reminders';
import { checkKills } from '@/lib/events';
import { helsinkiHour, QUIET_END } from '@/lib/quiet';
import { addDays, helsinkiToday, isGateDay, seasonWeek, weekRange, BOSS_WEEK } from '@/lib/season';
import { loadBattle } from '@/lib/battle';
import { sealView } from '@/lib/rules';
import { weaknessesOf, type MonsterPart } from '@/lib/trio';
import { MID_DAY } from '@/lib/midseason';

export const dynamic = 'force-dynamic';
// Ajastus lukee aina tuoreen tilanteen: Supabase-hakuja ei tallenneta Next.js:n välimuistiin.
export const fetchCache = 'force-no-store';

/**
 * Aamun ilmoitukset klo 9 Suomen aikaa (vercel.json ajaa tämän klo 6 ja 7 UTC, jotta kesä- ja talviaika
 * osuvat kumpikin klo 9:ään; aiemmin kuin klo 9 ei lähetetä mitään, ja kaikki on varattu kerran lähetettäväksi):
 * 1. hiljaisina tunteina (22–09) kirjoitetut viestit
 * 2. yöllä jonoon menneet ilmoitukset (monsteri kaatui, megamarssi, "vain sinä puutut", muistutukset)
 * 3. uuden monsterin paljastus viikon ensimmäisenä päivänä, loppupomon viimeinen viikonloppu (pe)
 *    ja kauden puoliväli (pe 6.11.)
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
    // Kaikille, myös lähettäjälle.
    sent += await sendPush(supabase, { title: `📣 ${m.profiles?.hero_name ?? 'Sankari'}`, body: m.body, url: '/viestit' }, (heroes ?? []).map((h) => h.id));
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

  // 2b. Klo 9 Kela-iskut tulevat voimaan: kaatoiko jokin niistä monsterin?
  await checkKills(supabase, day).catch((e) => console.error('Kaatumistarkistus epäonnistui', e));
  if (week >= 1 && week <= BOSS_WEEK && weekRange(week).start === day) {
    const { data: m } = await supabase.from('monsters').select('name, weakness, parts').eq('week', week).maybeSingle();
    const { data: season } = await supabase.from('season').select('hp_locked_at').eq('id', 1).maybeSingle();
    if (m?.name && season?.hp_locked_at && (await once(`reveal-${week}`))) {
      // Kaksikolla ja kolmikolla kaikkien osien heikkoudet.
      const weak = weaknessesOf(m as { weakness: string | null; parts: MonsterPart[] | null });
      result.paljastus = await sendPush(supabase, {
        title: week === BOSS_WEEK ? `🔥 Loppupomo heräsi: ${m.name}` : `👁️ Uusi monsteri: ${m.name}`,
        body: weak.length ? `${weak.length > 1 ? 'Heikkoudet' : 'Heikkous'}: ${weak.join(', ')} (+50 %). Viikko ${week} alkoi.` : `Viikko ${week} alkoi.`,
      });
    }
  }

  // 3b. Portinvartija (29.–30.9.): aamumuistutus, jos se on vielä pystyssä
  if (isGateDay(day) && (await once(`gate-${day}`))) {
    const { data: g } = await supabase.from('gate').select('name').eq('id', 1).maybeSingle();
    const { data: killed } = await supabase.from('notifications_sent').select('key').eq('key', 'gate-kill').maybeSingle();
    if (!killed) {
      result.portinvartija = await sendPush(supabase, {
        title: `👁️ ${g?.name || 'Sauronin silmä'} vartioi porttia`,
        body: 'Kaatakaa se ennen ke 30.9. klo 23.59, niin portti kauteen aukeaa. Treenit ja askeleet lyövät.',
      });
    }
  }

  // 3c. Loppupomon viikon perjantai: viimeinen viikonloppu (ennen perjantain omaa muistutusta).
  if (week === BOSS_WEEK && day === addDays(weekRange(week).end, -2) && (await once('boss-weekend'))) {
    const b = await loadBattle(supabase, day);
    const boss = b.ledger?.alive.find((f) => f.week === BOSS_WEEK);
    if (boss) {
      const hp = sealView(boss, b.required).hp;
      result.loppupomo = await sendPush(supabase, {
        title: '🔥 Viimeinen viikonloppu',
        body: `${b.monsters.get(BOSS_WEEK)?.name ?? 'Loppupomo'}: ${hp.toLocaleString('fi-FI')} HP jäljellä. Kausi päättyy su klo 24. Jokainen treeni ratkaisee.`,
      });
    }
  }

  // 3d. Kauden puoliväli pe 6.11.: raportti kauden alusta torstaihin (ennen perjantain omaa muistutusta).
  if (day === MID_DAY && (await once('midseason'))) {
    result.puolivali = await sendPush(supabase, {
      title: '📊 Kausi puolivälissä',
      body: 'Puolet takana. Katso porukan välitilanne, kärki ja kaatuneet monsterit.',
      url: '/raportti/puolivali',
    });
  }

  // 4. Perjantain oma viikkomuistutus
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', weekday: 'short' }).format(new Date());
  if (weekday === 'Fri' && week >= 1 && week <= BOSS_WEEK && (await once(`friday-${week}`))) {
    const r = await fridayReminders(supabase, day);
    result.perjantai = r.sent;
  }

  return NextResponse.json(result);
}
