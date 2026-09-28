import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPush } from '@/lib/push';

export const dynamic = 'force-dynamic';
// Ajastus lukee aina tuoreen tilanteen: Supabase-hakuja ei tallenneta Next.js:n välimuistiin.
export const fetchCache = 'force-no-store';

/**
 * Vercel Cron kutsuu tätä joka aamu (vercel.json). Lähettää hiljaisina tunteina (klo 22–07) kirjoitettujen
 * viestien push-ilmoitukset. Vaatii CRON_SECRET- ja SUPABASE_SERVICE_ROLE_KEY-ympäristömuuttujat.
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
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });

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
  return NextResponse.json({ messages: queued?.length ?? 0, sent });
}
