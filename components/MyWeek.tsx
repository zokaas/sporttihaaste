'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toggleSickDay, toggleStep } from '@/app/actions';
import { showStrike } from '@/components/StrikeToastHost';
import { STEP_DAY_DAMAGE } from '@/lib/rules';
import { formatDay } from '@/lib/season';
import Hint from '@/components/Hint';

type Day = { day: string; stepped: boolean; future: boolean; patrol: boolean; sick: boolean };

type Props = {
  week: number;
  days: Day[];
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
  const [askContinue, setAskContinue] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError('');
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Jokin meni pieleen.');
    router.refresh();
  }

  // Tämän päivän kuittaus näyttää iskuikkunan kuten Lyö-valikko; menneiden päivien jälkikuittaus on hiljainen.
  async function stepDay(day: string, on: boolean) {
    const live = on && day === today;
    const res = await toggleStep(day, on, live);
    if (res.ok && live && res.strike) showStrike({ strike: res.strike, damage: STEP_DAY_DAMAGE, label: '👣 Askeleet!' });
    return res;
  }

  const pct = p.target > 0 ? Math.min(100, (p.hours / p.target) * 100) : 100;
  const kept = p.target > 0 && p.hours >= p.target;
  const today = p.days.filter((d) => !d.future).at(-1)?.day;
  const stepCount = p.days.filter((d) => d.stepped && !d.sick).length;
  const sickCount = p.days.filter((d) => d.sick).length;
  const healthyDays = p.days.length - sickCount;
  const shortWeek = p.days.length < 7;

  function tapSick(d: Day) {
    // Tämän päivän merkinnästä kysytään, jatkuuko sairaus (silloin tulevat päivät merkitään automaattisesti).
    if (!d.sick && d.day === today) return setAskContinue(true);
    run(() => toggleSickDay(d.day, !d.sick));
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="display">Minun viikkoni</h2>
        <span className="muted small">Viikko {p.week}</span>
      </div>

      <div className="week-power">
        <strong>⚔️ {p.weekDamage.toLocaleString('fi-FI')} voimaa</strong>
        <span className="muted small">askeleista {p.stepDamage} · yhteistreenejä {p.togetherCount}</span>
      </div>

      <div className="myweek-block">
        <Hint
          id="pledge-hours"
          title={<div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><span className="muted small">Lupaustunnit</span><strong className={kept ? 'ok' : ''} style={{ fontSize: 22 }}>{p.target > 0 ? <>{h(p.hours)} / {h(p.target)}{kept ? ' ✓' : ''}</> : h(p.hours)}</strong></div>}
        >
          Lupaustunnit lasketaan lajin arvolla: tunti useimpia lajeja = 1 h, tunti uintia = 2 h, tunti joogaa, liikkuvuutta tai golfia = 0,5 h. Bonukset eivät kasvata lupaustunteja.
        </Hint>
        {p.target > 0 ? <div className="hpbar"><span style={{ width: `${pct}%`, background: kept ? 'var(--moss-text)' : 'var(--ember)' }} /></div> : null}
        <span className="muted small">
          {kept ? 'Lupaus pidetty! +100 ensi-iskuun, kun viikko lukittuu.' : p.target === 0 ? 'Tällä viikolla ei ole lupaustavoitetta sairauden vuoksi. Kirjatut treenit tuovat silti voimaa monsteria vastaan.' : `Vielä ${h(p.target - p.hours)}. Pidetty lupaus tuo +100 ensi-iskuun.`}
        </span>
        {shortWeek ? <span className="muted small">Lyhyt viikko ({p.days.length} pv): tavoite on {p.days.length}/7 lupauksestasi ({h(p.pledge)}).</span> : null}
        {p.sickDays ? <span className="small" style={{ color: 'var(--gold)' }}>🤒 {p.sickDays} sairaspäivää: tavoite {h(p.fullTarget)} → {h(p.target)}{p.inSeal ? '' : ' · ei sinettivelvollisuutta tällä viikolla'}</span> : null}
      </div>

      <div className="myweek-block">
        <Hint id="steps" title={<div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><span className="muted small">Askeleet (10 000 / pv)</span><strong>{stepCount} / {healthyDays} pv</strong></div>}>
          Napauta päivää, kun olet kävellyt 10 000 askelta: +50. Jos kaikki terveet kuittaavat saman päivän, siitä tulee megamarssi ⭐ +250.
        </Hint>
        <div className="weekstrip" style={{ gridTemplateColumns: `repeat(${p.days.length}, 1fr)` }}>
          {p.days.map((d) => {
            const [wd, date] = formatDay(d.day).split(' ');
            const state = d.sick ? 'sickday' : d.stepped ? 'done' : d.future ? 'future' : d.day === today ? 'today' : 'missed';
            return (
              <button
                key={d.day}
                type="button"
                className={`daycell ${state}`}
                aria-pressed={d.stepped}
                aria-label={`${formatDay(d.day)}: ${d.sick ? 'sairaspäivä' : d.stepped ? 'askeleet kuitattu' : d.future ? 'tulossa' : 'ei kuitattu'}${d.patrol ? ', megamarssi' : ''}`}
                disabled={d.future || d.sick || busy}
                onClick={() => run(() => stepDay(d.day, !d.stepped))}
              >
                <span>{wd}</span>
                <b>{d.sick ? '🤒' : d.patrol ? '⭐' : d.stepped ? '✓' : date.replace(/\.$/, '').split('.')[0]}</b>
              </button>
            );
          })}
        </div>
      </div>

      <details className="myweek-block sick-details" open={sickCount > 0 || askContinue}>
        <summary>
          <span>🤒 Sairaspäivät</span>
          <span className="muted small">{sickCount ? `${sickCount} pv tällä viikolla` : 'Merkitse, jos olet kipeä'}</span>
        </summary>
        <div className="weekstrip" style={{ gridTemplateColumns: `repeat(${p.days.length}, 1fr)` }}>
          {p.days.map((d) => {
            const [wd] = formatDay(d.day).split(' ');
            return (
              <button
                key={`s-${d.day}`}
                type="button"
                className={`sickcell${d.sick ? ' on' : ''}`}
                aria-pressed={d.sick}
                aria-label={`${formatDay(d.day)}: ${d.sick ? 'poista sairaspäivä' : 'merkitse sairaspäiväksi'}`}
                disabled={d.future || busy}
                onClick={() => tapSick(d)}
              >
                <span>{wd}</span>
                <b>{d.future ? '' : d.sick ? '🤒' : '+'}</b>
              </button>
            );
          })}
        </div>
        <span className="muted small">Jokainen sairaspäivä pienentää viikon lupausta 1/7:lla, ja yksikin sairaspäivä vapauttaa sinut sen viikon sinetistä. Sairaspäivältä poistuvat askeleet ja treenit.</span>
        {askContinue ? (
          <div className="sick-box">
            <strong>Onko paha?</strong>
            <span className="muted small">Jos sairaus tuntuu vievän pidemmän ajan, tulevat päivät merkitään automaattisesti, kunnes painat &quot;Olen taas terve&quot;.</span>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn grow" disabled={busy} onClick={() => { setAskContinue(false); run(() => toggleSickDay(today!, true, true)); }}>On paha</button>
              <button type="button" className="btn btn-ghost grow" disabled={busy} onClick={() => { setAskContinue(false); run(() => toggleSickDay(today!, true, false)); }}>Vain tänään</button>
            </div>
            <button type="button" className="linklike small" onClick={() => setAskContinue(false)}>Peru</button>
          </div>
        ) : null}
        {p.sick && p.sickSince ? (
          <>
            <span className="small"> Kipeänä {formatDay(p.sickSince)} alkaen. Sairaus jatkuu, kunnes merkitset itsesi terveeksi.</span>
            <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} disabled={busy} onClick={() => run(() => toggleSickDay(today!, false))}>💪 Olen taas terve</button>
          </>
        ) : null}
      </details>

      {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </section>
  );
}
