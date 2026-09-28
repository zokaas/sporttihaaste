'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, monsterImageUrl } from '@/lib/supabase/client';

export type Monster = {
  week: number;
  name: string | null;
  description: string | null;
  weakness: string | null;
  hp: number | null;
  image_path: string | null;
  revealed_at: string | null;
  parts: Part[] | null;
};

type Part = { name: string; description: string | null; weakness: string | null; image_path: string | null };
const emptyPart = (): Part => ({ name: '', description: null, weakness: null, image_path: null });

const WEAKNESSES = ['Kestävyys', 'Voimailu', 'Palloilu', 'Muu'];

/** Pienentää kuvan niin, että pidempi sivu on enintään 1024 px. */
async function shrinkJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', 0.85));
}

function MonsterRow({ monster }: { monster: Monster }) {
  const router = useRouter();
  const [m, setM] = useState(monster);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const revealed = m.revealed_at ? new Date(m.revealed_at) : null;
  const img = monsterImageUrl(m.image_path);

  async function save(patch: Partial<Monster>) {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().from('monsters').update(patch).eq('week', m.week);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setM({ ...m, ...patch });
    setMsg({ ok: true, text: 'Tallennettu.' });
    router.refresh();
  }

  async function uploadFile(file: File, suffix = '') {
    setBusy(true);
    setMsg(null);
    const path = `week-${m.week}${suffix}-${Date.now()}.jpg`;
    const { error } = await createClient().storage.from('monsters').upload(path, await shrinkJpeg(file), { contentType: 'image/jpeg' });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: `Kuvan lataus epäonnistui: ${error.message}` }); return null; }
    return path;
  }

  async function upload(file: File) {
    const path = await uploadFile(file);
    if (path) await save({ image_path: path });
  }

  const parts = m.parts;
  const setPart = (i: number, patch: Partial<Part>) => setM({ ...m, parts: parts!.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  async function uploadPart(i: number, file: File) {
    const path = await uploadFile(file, `-osa${i + 1}`);
    if (!path) return;
    const next = parts!.map((x, j) => (j === i ? { ...x, image_path: path } : x));
    // Ensimmäisen osan kuva toimii myös monsterin pääkuvana (bestiaario, ilmoitukset).
    await save(i === 0 ? { parts: next, image_path: path } : { parts: next });
  }

  function saveAll() {
    if (!parts) return save({ name: m.name?.trim() || null, description: m.description?.trim() || null, weakness: m.weakness, parts: null });
    const clean = parts.map((x) => ({ name: x.name.trim(), description: x.description?.trim() || null, weakness: x.weakness || null, image_path: x.image_path }));
    if (clean.some((x) => !x.name)) return setMsg({ ok: false, text: 'Anna jokaiselle kolmikon osalle nimi.' });
    const names = clean.map((x) => x.name);
    return save({
      parts: clean,
      name: `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`,
      description: m.description?.trim() || null,
      weakness: clean[0].weakness,
    });
  }

  return (
    <details className="monster-row">
      <summary>
        <strong>Vko {m.week}</strong> {m.name ?? <span className="muted">nimeämättä</span>}
        {m.parts ? <span className="muted small"> · kolmikko</span> : null}
        {!m.weakness && !m.parts && m.week !== 11 ? <span className="error small"> · heikkous puuttuu</span> : null}
        {!m.image_path ? <span className="error small"> · kuva puuttuu</span> : null}
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
        {m.week !== 11 ? (
          <label className="row" style={{ alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={Boolean(parts)} onChange={(e) => setM({ ...m, parts: e.target.checked ? [emptyPart(), emptyPart(), emptyPart()] : null })} />
            Monsterikolmikko (kolme osaa, HP tasan)
          </label>
        ) : null}
        {parts ? parts.map((part, i) => {
          const src = monsterImageUrl(part.image_path);
          return (
            <fieldset key={i} className="card" style={{ margin: 0, gap: 10 }}>
              <legend className="small muted">Osa {i + 1}{i === 2 ? ' (kaatuu viimeisenä, kun sinetti täyttyy)' : ''}</legend>
              {src ? <img src={src} alt="" style={{ width: '100%', borderRadius: 14 }} /> : null}
              <label className="btn btn-ghost" style={{ minHeight: 44 }}>
                {src ? 'Vaihda kuva' : 'Lataa kuva'}
                <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadPart(i, e.target.files[0])} />
              </label>
              <label className="field">
                Nimi
                <input className="input" value={part.name} onChange={(e) => setPart(i, { name: e.target.value })} />
              </label>
              <label className="field">
                Kuvaus
                <textarea className="input" rows={2} style={{ padding: 12 }} value={part.description ?? ''} onChange={(e) => setPart(i, { description: e.target.value })} />
              </label>
              <label className="field">
                Heikkous
                <select className="input" value={part.weakness ?? ''} onChange={(e) => setPart(i, { weakness: e.target.value || null })}>
                  <option value="">Ei heikkoutta</option>
                  {WEAKNESSES.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
            </fieldset>
          );
        }) : null}
        {!parts && img ? <img src={img} alt="" style={{ width: '100%', borderRadius: 14 }} /> : null}
        {!parts ? (
          <label className="btn btn-ghost" style={{ minHeight: 44 }}>
            {img ? 'Vaihda kuva' : 'Lataa kuva'}
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        ) : null}
        {!parts ? (
          <label className="field">
            Nimi
            <input className="input" value={m.name ?? ''} onChange={(e) => setM({ ...m, name: e.target.value })} />
          </label>
        ) : null}
        <label className="field">
          {parts ? 'Yhteinen kuvaus' : 'Kuvaus'}
          <textarea className="input" rows={3} style={{ padding: 12 }} value={m.description ?? ''} onChange={(e) => setM({ ...m, description: e.target.value })} />
        </label>
        {!parts ? (
          <label className="field">
            Heikkous
            <select className="input" value={m.weakness ?? ''} onChange={(e) => setM({ ...m, weakness: e.target.value || null })}>
              <option value="">Ei heikkoutta</option>
              {WEAKNESSES.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </label>
        ) : null}
        <p className="muted small" style={{ margin: 0 }}>
          HP {m.hp?.toLocaleString('fi-FI') ?? 'lukitsematta'}.{' '}
          {revealed ? `Paljastuu kaikille ${revealed.toLocaleString('fi-FI', { timeZone: 'Europe/Helsinki', weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}.` : 'Paljastusaikaa ei ole asetettu.'}
        </p>
        <button className="btn" type="button" disabled={busy} onClick={saveAll}>
          {busy ? 'Tallennetaan…' : 'Tallenna'}
        </button>
        {msg ? <p className={msg.ok ? 'ok' : 'error'} style={{ margin: 0 }}>{msg.text}</p> : null}
      </div>
    </details>
  );
}

export default function MonsterEditor({ monsters }: { monsters: Monster[] }) {
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{monsters.map((m) => <MonsterRow key={m.week} monster={m} />)}</div>;
}
