'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogHit } from '@/app/kirjaa/actions';
import { adminDeleteHit, adminDeleteSick, adminSetSick } from '@/app/yllapito/korjaukset/actions';

type Hero = { id: string; name: string };

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) {
    setBusy(true);
    setMsg(null);
    const res = await fn();
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? 'Virhe.' });
    router.refresh();
  }
  return { busy, msg, run };
}

const Msg = ({ msg }: { msg: { ok: boolean; text: string } | null }) =>
  msg ? <p className={msg.ok ? 'ok' : 'error'} role="status" style={{ margin: 0 }}>{msg.text}</p> : null;

export function DeleteRow({ id, kind }: { id: number; kind: 'hit' | 'sick' }) {
  const { busy, run } = useRun();
  return (
    <button type="button" className="btn btn-ghost" style={{ minHeight: 36, padding: '0 10px', fontSize: 13 }} disabled={busy}
      onClick={() => confirm('Poistetaanko?') && run(() => (kind === 'hit' ? adminDeleteHit(id) : adminDeleteSick(id)), 'Poistettu.')}>
      Poista
    </button>
  );
}

export function AdminHitForm({ heroes, sports, min, max }: { heroes: Hero[]; sports: string[]; min: string; max: string }) {
  const { busy, msg, run } = useRun();
  const [userId, setUserId] = useState(heroes[0]?.id ?? '');
  const [day, setDay] = useState(max);
  const [sport, setSport] = useState(sports[0]);
  const [minutes, setMinutes] = useState(60);
  const [companions, setCompanions] = useState<string[]>([]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label className="field">Sankari
        <select className="input" value={userId} onChange={(e) => { setUserId(e.target.value); setCompanions([]); }}>
          {heroes.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </label>
      <div className="row">
        <label className="field grow">Päivä<input className="input" type="date" min={min} max={max} value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <label className="field grow">Kesto (min)<input className="input" type="number" min={15} max={600} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
      </div>
      <label className="field">Laji
        <select className="input" value={sport} onChange={(e) => setSport(e.target.value)}>
          {sports.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <fieldset className="field-group"><legend>Seuralaiset</legend>
        <div className="chips">
          {heroes.filter((h) => h.id !== userId).map((h) => (
            <button key={h.id} type="button" className="chip" aria-pressed={companions.includes(h.id)}
              onClick={() => setCompanions((c) => (c.includes(h.id) ? c.filter((x) => x !== h.id) : [...c, h.id]))}>{h.name}</button>
          ))}
        </div>
      </fieldset>
      <button type="button" className="btn" disabled={busy} onClick={() => run(() => adminLogHit({ userId, day, sport, minutes, companions }), 'Isku kirjattu.')}>Kirjaa sankarin puolesta</button>
      <Msg msg={msg} />
    </div>
  );
}

export function AdminSickForm({ heroes, min, max }: { heroes: Hero[]; min: string; max: string }) {
  const { busy, msg, run } = useRun();
  const [userId, setUserId] = useState(heroes[0]?.id ?? '');
  const [start, setStart] = useState(max);
  const [end, setEnd] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label className="field">Sankari
        <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {heroes.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </label>
      <div className="row">
        <label className="field grow">Alkaen<input className="input" type="date" min={min} value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field grow">Viimeinen päivä<input className="input" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>
      <span className="muted small">Jätä viimeinen päivä tyhjäksi, jos sairaus jatkuu.</span>
      <button type="button" className="btn" disabled={busy} onClick={() => run(() => adminSetSick(userId, start, end || null), 'Sairaus merkitty.')}>Merkitse kipeäksi</button>
      <Msg msg={msg} />
    </div>
  );
}
