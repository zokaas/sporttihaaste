'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePledge, setSick, toggleStep } from '@/app/actions';
import { formatDay } from '@/lib/season';

type Props = {
  week: number;
  days: { day: string; stepped: boolean; future: boolean; patrol: boolean }[];
  target: number;
  hours: number;
  sickDays: number;
  sick: boolean;
  weekDamage: number;
  stepDamage: number;
  togetherCount: number;
  pledge: number;
  nextPledge: number | null;
  canChangePledge: boolean;
};

const h = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} h`;

export default function MyWeek(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [newPledge, setNewPledge] = useState(p.nextPledge ?? p.pledge);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError('');
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Jokin meni pieleen.');
    router.refresh();
  }

  const pct = p.target > 0 ? Math.min(100, (p.hours / p.target) * 100) : 100;
  const kept = p.target > 0 && p.hours >= p.target;

  return (
    <section className="card">
      <h2 className="display">Minun viikkoni</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <strong>Lupaus</strong>
          <span className={kept ? 'ok' : ''}>{h(p.hours)} / {h(p.target)}{kept ? ' ✓' : ''}</span>
        </div>
        <div className="hpbar"><span style={{ width: `${pct}%`, background: kept ? 'var(--moss-text)' : 'var(--ember)' }} /></div>
        <span className="muted small">
          {kept ? 'Lupaus pidetty! +100 pottiin, kun viikko lukittuu.' : p.target === 0 ? 'Ei lupausta tällä viikolla sairauden vuoksi.' : `Vielä ${h(p.target - p.hours)}. Pidetty lupaus tuo +100 pottiin.`}
          {p.sickDays ? ` Tavoitteesta on vähennetty ${p.sickDays} sairaspäivää.` : ''}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong>Askeleet <span className="muted small">(+50 / päivä, kaikki terveet samana päivänä: partio +250)</span></strong>
        <div className="chips">
          {p.days.map((d) => (
            <button
              key={d.day}
              type="button"
              className="chip"
              aria-pressed={d.stepped}
              disabled={d.future || busy}
              style={d.future ? { opacity: 0.35 } : undefined}
              onClick={() => run(() => toggleStep(d.day, !d.stepped))}
              title={d.patrol ? 'Partiopäivä!' : undefined}
            >
              {d.patrol ? '⭐ ' : d.stepped ? '✓ ' : ''}{formatDay(d.day)}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><span className="muted small">Vahinkosi tällä viikolla</span><strong>{p.weekDamage.toLocaleString('fi-FI')}</strong><span className="muted small">josta askeleet {p.stepDamage}</span></div>
        <div className="stat"><span className="muted small">Yhteistreenit</span><strong>{p.togetherCount}</strong><span className="muted small">3+ hengen iskut</span></div>
      </div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost grow" disabled={busy} onClick={() => run(() => setSick(!p.sick))}>
          {p.sick ? 'Olen taas terve' : 'Olen kipeä'}
        </button>
      </div>
      {p.sick ? <p className="note" style={{ margin: 0 }}>Olet merkinnyt itsesi kipeäksi. Lupauksesi pienenee sairaspäivien verran, eikä sinua tarvita sinettiin tällä viikolla.</p> : null}

      {p.canChangePledge ? (
        <details>
          <summary className="muted" style={{ cursor: 'pointer' }}>Muuta lupausta ensi viikosta{p.nextPledge !== null ? ` (muutettu: ${h(p.nextPledge)})` : ''}</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10 }}>
            <div className="stepper">
              <button type="button" aria-label="Pienennä" onClick={() => setNewPledge((x) => Math.max(1, x - 0.5))}>−</button>
              <div className="value"><strong style={{ fontSize: 30 }}>{h(newPledge)}</strong><span className="muted small">viikolta {p.week + 1} alkaen</span></div>
              <button type="button" aria-label="Kasvata" onClick={() => setNewPledge((x) => Math.min(15, x + 0.5))}>+</button>
            </div>
            <button type="button" className="btn" disabled={busy || newPledge === (p.nextPledge ?? p.pledge)} onClick={() => run(() => changePledge(newPledge))}>Tallenna uusi lupaus</button>
            <span className="muted small">Lupausta voi muuttaa kerran viikossa. Muutos alkaa aina seuraavalta viikolta.</span>
          </div>
        </details>
      ) : null}

      {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </section>
  );
}
