import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fridayReminders } from '@/lib/reminders';
import { helsinkiToday, seasonWeek, BOSS_WEEK } from '@/lib/season';

export const dynamic = 'force-dynamic';
// Ajastus lukee aina tuoreen tilanteen: Supabase-hakuja ei tallenneta Next.js:n välimuistiin.
export const fetchCache = 'force-no-store';

/**
 * Vercel Cron kutsuu tätä perjantaisin (vercel.json). Vaatii ympäristömuuttujat CRON_SECRET ja
 * SUPABASE_SERVICE_ROLE_KEY: ajastuksella ei ole kirjautunutta käyttäjää, joten tietokantaa luetaan palvelinavaimella.
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

  const day = helsinkiToday();
  const week = seasonWeek(day);
  if (week < 1 || week > BOSS_WEEK) return NextResponse.json({ skipped: 'Ei kautta.' });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  // Vain kerran viikossa, vaikka ajastus laukeaisi useammin.
  const { error: dup } = await supabase.from('notifications_sent').insert({ key: `friday-${week}` });
  if (dup) return NextResponse.json({ skipped: 'Jo lähetetty.' });

  const result = await fridayReminders(supabase, day);
  return NextResponse.json(result);
}
