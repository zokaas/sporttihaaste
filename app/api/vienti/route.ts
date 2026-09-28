import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TABLES = ['hits', 'step_days', 'sick_periods', 'pledge_changes', 'profiles', 'monsters'];

function cell(v: unknown) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Ylläpitäjän varmuuskopio: yksi taulu CSV-muodossa. */
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Kirjaudu ensin.' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!me?.is_admin) return NextResponse.json({ error: 'Vain ylläpitäjä.' }, { status: 403 });

  const table = new URL(request.url).searchParams.get('taulu') ?? '';
  if (!TABLES.includes(table)) return NextResponse.json({ error: 'Tuntematon taulu.' }, { status: 400 });
  const { data, error } = await supabase.from(table).select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const csv = [cols.join(';'), ...rows.map((r) => cols.map((c) => cell((r as Record<string, unknown>)[c])).join(';'))].join('\r\n');
  const day = new Date().toISOString().slice(0, 10);
  // BOM, jotta Excel tunnistaa ääkköset
  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="monsterijahti-${table}-${day}.csv"`,
    },
  });
}
