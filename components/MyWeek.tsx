'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setSick, toggleStep } from '@/app/actions';
import { formatDay } from '@/lib/season';
import Hint from '@/components/Hint';

type Props = {
  week: number;
  days: { day: string; stepped: boolean; future: boolean; patrol: boolean }[];
  target: number;
  hours: number;
  sickDays: number;
  sick: boolean;
  sickSince: string | null;
  fullTarget: number;
  inSeal: boolean;
  weekDamage: number;
  stepDamage: number;
  togetherCount: number;
  pledge: number;
};

const h = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} h`;

export default function MyWeek(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sickPick, setSickPick] = useState<string | null>(null);

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

  const today = p.days.filter((d) => !d.future).at(-1)?.day;
  const stepCount = p.days.filter((d) => d.stepped).length;

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="display">Minun viikkoni</h2>
        <span className="muted small">Viikko {p.week}</span>
      </div>

      <div className="myweek-block">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="muted small">Treenit / lupaus</span>
          <strong className={kept ? 'ok' : ''} style={{ fontSize: 22 }}>{h(p.hours)} / {h(p.target)}{kept ? ' ✓' : ''}</strong>
        </div>
        <div className="hpbar"><span style={{ width: `${pct}%`, background: kept ? 'var(--moss-text)' : 'var(--ember)' }} /></div>
        <span className="muted small">
          {kept ? 'Lupaus pidetty! +100 pottiin, kun viikko lukittuu.' : p.target === 0 ? 'Ei lupausta tällä viikolla sairauden vuoksi.' : `Vielä ${h(p.target - p.hours)}. Pidetty lupaus tuo +100 pottiin.`}
        </span>
      </div>

      <div className="myweek-block">
        <Hint id="steps" title={<div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><span className="muted small">Askeleet (10 000 / pv)</span><strong>{stepCount} / {p.days.length} pv</strong></div>}>Napauta päivää, kun olet kävellyt 10 000 askelta: +50. Jos kaikki terveet kuittaavat saman päivän, siitä tulee partiopäivä ⭐ +250.</Hint>
        <div className="weekstrip" style={{ gridTemplateColumns: `repeat(${p.days.length}, 1fr)` }}>
          {p.days.map((d) => {
            const [wd, date] = formatDay(d.day).split(' ');
            const state = d.stepped ? 'done' : d.future ? 'future' : d.day === today ? 'today' : 'missed';
            return (
              <button
                key={d.day}
                type="button"
                className={`daycell ${state}`}
                aria-pressed={d.stepped}
                aria-label={`${formatDay(d.day)}: ${d.stepped ? 'kuitattu' : d.future ? 'tulossa' : 'ei kuitattu'}${d.patrol ? ', partiopäivä' : ''}`}
                disabled={d.future || busy}
                onClick={() => run(() => toggleStep(d.day, !d.stepped))}
              >
                <span>{wd}</span>
                <b>{d.patrol ? '⭐' : d.stepped ? '✓' : date.replace(/\.$/, '').split('.')[0]}</b>
              </button>
            );
          })}
        </div>
      </div>

      <p className="muted small" style={{ margin: 0 }}>
        Voimasi tällä viikolla <strong style={{ color: 'var(--text)' }}>{p.weekDamage.toLocaleString('fi-FI')}</strong> (askeleista {p.stepDamage}) · yhteistreenejä {p.togetherCount}
      </p>

      {p.sick ? (
        <div className="sick-box">
          <strong>🤒 Kipeänä {p.sickSince ? `${formatDay(p.sickSince)} alkaen` : ''}</strong>
          <ul>
            <li>Lupaus tällä viikolla: {h(p.fullTarget)} → <strong>{h(p.target)}</strong></li>
            <li>Et ole mukana tämän viikon sinetissä.</li>
            <li>Partiopäivään riittävät terveet sankarit.</li>
          </ul>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => setSick(false))}>💪 Olen taas terve</button>
          <span className="muted small">{p.sickSince && p.sickSince >= (today ?? '') ? 'Tänään tehty merkintä perutaan kokonaan.' : 'Viimeiseksi sairaspäiväksi merkitään eilinen.'}</span>
        </div>
      ) : sickPick !== null ? (
        <div className="sick-box">
          <strong>🤒 Mistä päivästä alkaen olet kipeä?</strong>
          <div className="chips">
            {p.days.filter((d) => !d.future).reverse().map((d) => (
              <button key={d.day} type="button" className="chip" aria-pressed={sickPick === d.day} onClick={() => setSickPick(d.day)}>{d.day === today ? 'Tänään' : formatDay(d.day)}</button>
            ))}
          </div>
          <span className="muted small">Viikon lupaus pienenee sairaspäivien verran, etkä ole mukana tämän viikon sinetissä.</span>
          <div className="row">
            <button type="button" className="btn grow" disabled={busy || !sickPick} onClick={() => run(() => setSick(true, sickPick!)).then(() => setSickPick(null))}>Merkitse kipeäksi</button>
            <button type="button" className="btn btn-ghost" onClick={() => setSickPick(null)}>Peru</button>
          </div>
        </div>
      ) : (
        <>
          {p.sickDays ? <p className="note" style={{ margin: 0 }}>Olit tällä viikolla kipeänä {p.sickDays} pv: lupaus {h(p.fullTarget)} → {h(p.target)}{p.inSeal ? '' : ', etkä ole mukana tämän viikon sinetissä'}.</p> : null}
          <div className="row" style={{ flexWrap: 'wrap', gap: 16 }}>
            <button type="button" className="linklike small" disabled={busy} onClick={() => setSickPick(today ?? '')}>🤒 Olen kipeä</button>
          </div>
        </>
      )}

      {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </section>
  );
}
