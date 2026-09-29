'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES, SPECIAL_WEAKNESSES, hitDamage, specialOf, type Category, type Weakness } from '@/lib/rules';
import { formatDay } from '@/lib/season';
import { logHit } from '@/app/kirjaa/actions';
import Hint from '@/components/Hint';

type Props = {
  days: string[];
  sports: { name: string; value: number; category: Category }[];
  companions: { id: string; name: string; avatar: string | null }[];
  /** Päivän terveet sankarit (koko porukka -bonus). */
  healthyByDay: Record<string, number>;
  weakness: Weakness[];
  celebrations: Record<string, string[]>;
};


function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

export default function HitForm({ days, sports, companions, weakness, celebrations, healthyByDay }: Props) {
  const router = useRouter();
  const [day, setDay] = useState(days[days.length - 1]);
  const [sportName, setSportName] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [withIds, setWithIds] = useState<string[]>([]);
  const [groupOpen, setGroupOpen] = useState(false);
  // Viikon erikoisheikkous (esim. "Urheilija on nainen"): kirjaaja merkitsee itse, täyttyikö ehto.
  const special = specialOf(weakness);
  const [claimed, setClaimed] = useState(false);
  const claim = special && claimed ? special : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sport = sports.find((s) => s.name === sportName);
  const celebrating = celebrations[day] ?? [];
  const preview = sport
    ? hitDamage({ minutes, sportValue: sport.value, category: sport.category, groupSize: 1 + withIds.length, celebration: celebrating.length > 0, weakness, sport: sport.name, special: claim, participants: healthyByDay[day] ?? companions.length + 1 })
    : null;

  const toggle = (id: string) => setWithIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function submit() {
    if (!sport) return setError('Valitse laji.');
    setBusy(true);
    setError('');
    const res = await logHit({ day, sport: sport.name, minutes, companions: withIds, special: claim });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    // Etusivulla isku näkyy lentävänä lukuna ja HP-palkki laskee.
    router.push(`/?isku=${res.damage}${(res.pct ?? 0) >= 100 ? '&krit=1' : ''}`);
    router.refresh();
  }

  return (
    <section className="card">
      <fieldset className="field-group">
        <legend>Päivä</legend>
        <div className="chips">
          {days.map((d) => (
            <button key={d} type="button" className="chip" aria-pressed={d === day} onClick={() => setDay(d)}>{formatDay(d)}</button>
          ))}
        </div>
        {celebrating.length ? <span className="small ok">🎉 Juhlapäivä: {celebrating.join(', ')}</span> : null}
      </fieldset>

      <label className="field">
        Laji
        <select className="input" value={sportName} onChange={(e) => setSportName(e.target.value)}>
          <option value="">Valitse laji</option>
          {CATEGORIES.map((c) => (
            <optgroup key={c} label={weakness.includes(c) ? `${c} (viikon heikkous)` : c}>
              {sports.filter((s) => s.category === c).map((s) => (
                <option key={s.name} value={s.name}>{s.name}{s.value !== 100 ? ` (${s.value}/h)` : ''}{weakness.includes(s.name) ? ' · viikon heikkous!' : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <fieldset className="field-group">
        <legend>Kesto</legend>
        <div className="stepper">
          <button type="button" aria-label="Lyhennä 15 min" onClick={() => setMinutes((m) => Math.max(15, m - 15))}>−</button>
          <div className="value"><strong style={{ fontSize: 30 }}>{duration(minutes)}</strong></div>
          <button type="button" aria-label="Pidennä 15 min" onClick={() => setMinutes((m) => Math.min(600, m + 15))}>+</button>
        </div>
      </fieldset>

      {companions.length ? (
        <details className="companions" open={groupOpen} onToggle={(e) => setGroupOpen((e.target as HTMLDetailsElement).open)}>
          <summary>
            <span>Treenasitko porukassa?</span>
            <span className="muted small">{withIds.length ? `${withIds.length + 1} henkeä` : 'Yksin'} ▾</span>
          </summary>
          <div style={{ margin: '8px 0' }}><Hint id="companions">Valitse seuralaiset. Vähintään 3 yhdessä: +50 %, koko porukka (kaikki sinä päivänä terveet): +100 %.</Hint></div>
          <div className="chips">
            {companions.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={withIds.includes(c.id)} onClick={() => toggle(c.id)}>
                {c.avatar ? <img className="avatar" src={c.avatar} alt="" width={22} height={22} /> : null}
                {c.name}
              </button>
            ))}
          </div>
        </details>
      ) : null}

      {special ? (
        <label className="family-check">
          <input type="checkbox" checked={claimed} onChange={(e) => setClaimed(e.target.checked)} />
          <span><strong>{SPECIAL_WEAKNESSES[special].check}</strong><span className="muted small">Viikon heikkous: +50 %</span></span>
        </label>
      ) : null}

      {preview ? (
        <div className="note" aria-live="polite">
          <div>Perusvoima {preview.base} ({duration(minutes)} × {sport!.value}/h)</div>
          {preview.bonuses.map((b) => <div key={b.label}>{b.label}: +{b.pct} %</div>)}
          {preview.pct === 200 && preview.bonuses.reduce((a, b) => a + b.pct, 0) > 200 ? <div className="muted small">Bonusten katto on +200 %.</div> : null}
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>Isku: {preview.damage}</div>
        </div>
      ) : null}

      <button className="btn" type="button" disabled={busy || !sport} onClick={submit}>{busy ? 'Tallennetaan…' : preview ? `Lyö ${preview.damage}` : 'Valitse laji'}</button>
      {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </section>
  );
}
