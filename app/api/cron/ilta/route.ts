import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fridayReminders } from '@/lib/reminders';
import { sendPush } from '@/lib/push';
import { checkKills } from '@/lib/events';
import { helsinkiToday, seasonWeek, weekRange, BOSS_WEEK } from '@/lib/season';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Sunnuntai-illan muistutus (vercel.json ajaa tämän su klo 17 UTC eli klo 19–20 Suomen aikaa):
 * jokaiselle, jolta viikolta vielä puuttuu jotain, oma viesti ja kehotus kirjata ma klo 12 mennessä.
 * Kerran viikossa (sunday-<viikko>). Vaatii CRON_SECRET- ja SUPABASE_SERVICE_ROLE_KEY-ympäristömuuttujat.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Ei oikeutta.' }, { status: 401 });
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY puuttuu.' }, { status: 500 });

  const day = helsinkiToday();
  const week = seasonWeek(day);
  if (week < 1 || week > BOSS_WEEK || weekRange(week).end !== day) return NextResponse.json({ skipped: 'Ei viikon viimeinen päivä.' });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  // Ennakkopaljastus: jos viikon monsteri kaatui jo aiemmin, seuraava paljastui su klo 19 ja siitä lähtee ilmoitus nyt.
  await checkKills(supabase, day).catch((e) => console.error('Ennakkopaljastus', e));
  if ((await supabase.from('notifications_sent').insert({ key: `sunday-${week}` })).error) return NextResponse.json({ skipped: 'Jo lähetetty.' });
  try {
    const r = await fridayReminders(supabase, day, undefined, 'sunday');
    return NextResponse.json({ sunnuntai: r.sent });
  } catch (e) {
    // Virheestä ilmoitus ylläpitäjille, jotta muistutuksen puuttuminen huomataan.
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Iltaajo', e);
    // Avain pois, jotta ajon voi ajaa uudelleen käsin (jo muistutuksen saaneet voivat saada sen toiseen kertaan).
    await supabase.from('notifications_sent').delete().eq('key', `sunday-${week}`);
    const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
    await sendPush(supabase, { title: '⚠️ Sunnuntain muistutus epäonnistui', body: `${msg.slice(0, 140)} Aja uudelleen: Vercel → Cron Jobs → /api/cron/ilta.`, url: '/yllapito' }, (admins ?? []).map((a) => a.id)).catch(() => 0);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
