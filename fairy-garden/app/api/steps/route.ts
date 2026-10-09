import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { helsinkiDay, isDay } from '@/lib/garden';

export const dynamic = 'force-dynamic';

/** iOS-oikotie lähettää: { "token": "...", "steps": 8234, "day": "2026-10-09" (valinnainen) } */
export async function POST(req: Request) {
  let body: { token?: unknown; steps?: unknown; day?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Virheellinen JSON' }, { status: 400 });
  }
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const steps = Math.round(Number(body.steps));
  const day = isDay(body.day) ? body.day : helsinkiDay();
  if (!token || !Number.isFinite(steps) || steps < 0 || steps > 200_000) {
    return NextResponse.json({ error: 'Tarkista token ja askelmäärä' }, { status: 400 });
  }

  const supabase = db();
  const { data: fairy } = await supabase.from('fairies').select('id, name').eq('token', token).maybeSingle();
  if (!fairy) return NextResponse.json({ error: 'Tuntematon token' }, { status: 401 });

  // Pidetään päivän suurin arvo, jotta myöhäinen nollasynkronointi ei tyhjennä päivää.
  const { data: existing } = await supabase.from('steps').select('steps').eq('fairy_id', fairy.id).eq('day', day).maybeSingle();
  const value = Math.max(steps, existing?.steps ?? 0);
  const { error } = await supabase
    .from('steps')
    .upsert({ fairy_id: fairy.id, day, steps: value, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: 'Tallennus epäonnistui' }, { status: 500 });
  return NextResponse.json({ ok: true, name: fairy.name, day, steps: value });
}
