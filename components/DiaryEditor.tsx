'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDay } from '@/lib/season';
import type { DiaryEntry } from '@/lib/diary';

/** Ylläpito: päiväkirjamerkinnät päivämäärittäin. Merkintä näkyy pelaajille omana päivänään, ilmoitus lähtee klo 9. */
export default function DiaryEditor({ today }: { today: string }) {
  const [entries, setEntries] = useState<DiaryEntry[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [day, setDay] = useState(today);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await createClient().from('diary').select('day, title, body').order('day');
    if (error) return setMissing(true);
    setEntries((data ?? []) as DiaryEntry[]);
  }
  useEffect(() => { load(); }, []);

  function pick(e: DiaryEntry) {
    setDay(e.day);
    setTitle(e.title ?? '');
    setBody(e.body);
    setMsg(null);
  }

  async function save() {
    if (!body.trim()) return setMsg({ ok: false, text: 'Kirjoita merkintä.' });
    setBusy(true);
    const { error } = await createClient().from('diary').upsert({ day, title: title.trim() || null, body: body.trim(), updated_at: new Date().toISOString() });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: `Tallennettu ${formatDay(day)}.` });
    if (!error) load();
  }

  async function remove(d: string) {
    if (!confirm(`Poistetaanko ${formatDay(d)} merkintä?`)) return;
    await createClient().from('diary').delete().eq('day', d);
    load();
  }

  return (
    <section className="card" id="paivakirja">
      <h2 className="display">📜 Päiväkirja</h2>
      <p className="muted small" style={{ margin: 0 }}>Tarinamerkintä päiväksi (esim. zombien päiväkirja). Näkyy Taistelu-sivulla omana päivänään, ja aamulla klo 9 siitä lähtee ilmoitus kaikille. Tulevia ei näe kukaan muu.</p>
      {missing ? <p className="note threat" style={{ margin: 0 }}>Aja migraatio 036_paivakirja.sql, niin päiväkirja toimii.</p> : (
        <>
          <div className="row">
            <label className="field grow">Päivä<input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
            <label className="field grow">Otsikko<input className="input" value={title} placeholder="Zom-Zamin päiväkirja, päivä 1" onChange={(e) => setTitle(e.target.value)} /></label>
          </div>
          <label className="field">Merkintä
            <textarea className="input" rows={6} style={{ padding: 12 }} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
          <button type="button" className="btn" disabled={busy} onClick={save}>Tallenna merkintä</button>
          {msg ? <p className={msg.ok ? 'ok' : 'error'} role="status" style={{ margin: 0 }}>{msg.text}</p> : null}
          {entries?.length ? (
            <ul className="people">
              {entries.map((e) => (
                <li key={e.day}>
                  <button type="button" className="grow tap" style={{ textAlign: 'left', background: 'none', border: 0, color: 'inherit', padding: 0, minWidth: 0 }} onClick={() => pick(e)}>
                    <div className="who">{formatDay(e.day)}{e.day > today ? ' · tulossa' : ''}{e.title ? ` · ${e.title}` : ''}</div>
                    <div className="facts" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.body}</div>
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ minHeight: 36, padding: '0 10px', fontSize: 13 }} onClick={() => remove(e.day)}>Poista</button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
