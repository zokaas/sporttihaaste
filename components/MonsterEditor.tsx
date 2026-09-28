'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, monsterImageUrl } from '@/lib/supabase/client';
import { BOSS_WEEK } from '@/lib/season';
import { bossWhisper } from '@/lib/boss';

export type Monster = {
  week: number;
  name: string | null;
  description: string | null;
  weakness: string | null;
  hp: number | null;
  image_path: string | null;
  revealed_at: string | null;
  parts: Part[] | null;
  taunt_half?: string | null;
  taunt_low?: string | null;
  teaser?: string | null;
  boss_whisper?: string | null;
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
    const extras = { taunt_half: m.taunt_half?.trim() || null, taunt_low: m.taunt_low?.trim() || null, teaser: m.teaser?.trim() || null, boss_whisper: m.boss_whisper?.trim() || null };
    if (!parts) return save({ name: m.name?.trim() || null, description: m.description?.trim() || null, weakness: m.weakness, parts: null, ...extras });
    const clean = parts.map((x) => ({ name: x.name.trim(), description: x.description?.trim() || null, weakness: x.weakness || null, image_path: x.image_path }));
    if (clean.some((x) => !x.name)) return setMsg({ ok: false, text: 'Anna jokaiselle kolmikon osalle nimi.' });
    const names = clean.map((x) => x.name);
    return save({
      parts: clean,
      name: `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`,
      description: m.description?.trim() || null,
      ...extras,
      weakness: clean[0].weakness,
    });
  }

  const [swapWith, setSwapWith] = useState('');

  // Vaihtaa tämän ja toisen viikon sisällön (nimi, kuvaus, heikkous, kuva, kolmikko). HP ja paljastusaika pysyvät viikolla.
  async function swap() {
    const other = Number(swapWith);
    if (!other) return;
    if (!confirm(`Vaihdetaanko viikkojen ${m.week} ja ${other} monsterit keskenään?`)) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const cols = 'name, description, weakness, image_path, parts, teaser, taunt_half, taunt_low, boss_whisper';
    const [{ data: a, error: e1 }, { data: b, error: e2 }] = await Promise.all([
      supabase.from('monsters').select(cols).eq('week', m.week).single(),
      supabase.from('monsters').select(cols).eq('week', other).single(),
    ]);
    const err = e1 ?? e2;
    if (err || !a || !b) { setBusy(false); return setMsg({ ok: false, text: err?.message ?? 'Monsteria ei löytynyt.' }); }
    const r1 = await supabase.from('monsters').update(b).eq('week', m.week);
    const r2 = r1.error ? r1 : await supabase.from('monsters').update(a).eq('week', other);
    setBusy(false);
    if (r2.error) return setMsg({ ok: false, text: r2.error.message });
    window.location.reload();
  }

  return (
    <details className="monster-row">
      <summary>
        <strong>Vko {m.week}</strong> {m.name ?? <span className="muted">nimeämättä</span>}
        {m.parts ? <span className="muted small"> · kolmikko</span> : null}
        {!m.weakness && !m.parts && m.week !== BOSS_WEEK ? <span className="error small"> · heikkous puuttuu</span> : null}
        {!m.image_path ? <span className="error small"> · kuva puuttuu</span> : null}
      </summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
        {m.week !== BOSS_WEEK ? (
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
        <label className="field">
          Arvoitus (näkyy kaikille edellisen viikon perjantaista alkaen)
          <textarea className="input" rows={2} style={{ padding: 12 }} placeholder="Esim. Ensi viikolla vastaan tulee jotain, mikä pelkää palloja…" value={m.teaser ?? ''} onChange={(e) => setM({ ...m, teaser: e.target.value })} />
        </label>
        <label className="field">
          Repliikki, kun HP alle 50 %
          <input className="input" placeholder="Tuo sattui. Mutta pelkkä naarmu, sankarit!" value={m.taunt_half ?? ''} onChange={(e) => setM({ ...m, taunt_half: e.target.value })} />
        </label>
        <label className="field">
          Repliikki, kun HP alle 20 %
          <input className="input" placeholder="Ei… ei vielä… minä en kaadu näin helposti!" value={m.taunt_low ?? ''} onChange={(e) => setM({ ...m, taunt_low: e.target.value })} />
        </label>
        {m.week < BOSS_WEEK ? (
          <label className="field">
            Loppupomon kuiskaus, kun tämä monsteri kaatuu
            <input className="input" placeholder={bossWhisper(m.week) ?? ''} value={m.boss_whisper ?? ''} onChange={(e) => setM({ ...m, boss_whisper: e.target.value })} />
          </label>
        ) : null}
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
        {m.week !== BOSS_WEEK ? (
          <div className="row" style={{ alignItems: 'center' }}>
            <select className="input grow" style={{ minWidth: 0 }} value={swapWith} onChange={(e) => setSwapWith(e.target.value)} aria-label="Vaihda paikkaa viikon kanssa">
              <option value="">Vaihda paikkaa viikon kanssa…</option>
              {Array.from({ length: BOSS_WEEK - 1 }, (_, i) => i + 1).filter((w) => w !== m.week).map((w) => <option key={w} value={w}>Viikko {w}</option>)}
            </select>
            <button type="button" className="btn btn-ghost" style={{ flexShrink: 0 }} disabled={busy || !swapWith} onClick={swap}>Vaihda</button>
          </div>
        ) : null}
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
