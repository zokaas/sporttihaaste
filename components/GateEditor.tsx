'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, monsterImageUrl } from '@/lib/supabase/client';
import { shrinkJpeg } from '@/components/MonsterEditor';
import { GATE_HP_DEFAULT, type GateRow } from '@/lib/gate';

/** Ylläpito: portinvartijan nimi, kuvaus, repliikki, HP ja kuva. */
export default function GateEditor({ gate }: { gate: GateRow }) {
  const router = useRouter();
  const [g, setG] = useState(gate);
  const [hp, setHp] = useState(String(gate.hp ?? GATE_HP_DEFAULT));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(patch: Partial<GateRow>) {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().from('gate').update(patch).eq('id', 1);
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setG({ ...g, ...patch });
    setMsg({ ok: true, text: 'Tallennettu.' });
    router.refresh();
  }

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    const path = `portinvartija-${Date.now()}.jpg`;
    const { error } = await createClient().storage.from('monsters').upload(path, await shrinkJpeg(file), { contentType: 'image/jpeg' });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: `Kuvan lataus epäonnistui: ${error.message}` });
    await save({ image_path: path });
  }

  function saveAll() {
    const n = Math.round(Number(hp));
    if (!Number.isFinite(n) || n < 100) return setMsg({ ok: false, text: 'Anna HP (vähintään 100).' });
    save({ name: g.name?.trim() || null, description: g.description?.trim() || null, taunt: g.taunt?.trim() || null, hp: n });
  }

  const img = monsterImageUrl(g.image_path);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {img ? <img src={img} alt="" style={{ width: '100%', borderRadius: 14 }} /> : null}
      <label className="btn btn-ghost" style={{ minHeight: 44 }}>
        {img ? 'Vaihda kuva' : 'Lataa kuva'}
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      <label className="field">Nimi
        <input className="input" value={g.name ?? ''} placeholder="Sauronin silmä" onChange={(e) => setG({ ...g, name: e.target.value })} />
      </label>
      <label className="field">HP
        <input className="input" type="number" inputMode="numeric" min={100} step={100} value={hp} onChange={(e) => setHp(e.target.value)} />
      </label>
      <label className="field">Kuvaus
        <textarea className="input" rows={6} style={{ padding: 12 }} value={g.description ?? ''} onChange={(e) => setG({ ...g, description: e.target.value })} />
      </label>
      <label className="field">Repliikki (puhekupla)
        <input className="input" value={g.taunt ?? ''} placeholder="Näen teidät. Portti ei aukea kenellekään." onChange={(e) => setG({ ...g, taunt: e.target.value })} />
      </label>
      <button type="button" className="btn" disabled={busy} onClick={saveAll}>{busy ? 'Tallennetaan…' : 'Tallenna portinvartija'}</button>
      {msg ? <p className={`note${msg.ok ? '' : ' threat'}`} role="status" style={{ margin: 0 }}>{msg.text}</p> : null}
    </div>
  );
}
