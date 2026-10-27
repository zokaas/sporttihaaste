'use client';
import { useEffect, useState } from 'react';
import { writeTarget } from '@/lib/target';
import TargetChoice, { type TargetPart } from '@/components/TargetChoice';
import { useRouter } from 'next/navigation';
import { toggleSickDay, toggleStep } from '@/app/actions';
import { goStrike, stepStrikeQuery } from '@/lib/goStrike';
import { formatDay } from '@/lib/season';
import Hint from '@/components/Hint';

type Day = { day: string; stepped: boolean; future: boolean; patrol: boolean; sick: boolean };

type Props = {
  week: number;
  grace?: boolean;
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
  /** Kohteen valinta: askelkuittaus kysyy, ketä lyödään. */
  targets?: TargetPart[] | null;
};

const h = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} h`;

export default function MyWeek(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [askContinue, setAskContinue] = useState(false);
  // Askelpäivä, jolle kysytään kohdetta (kohteen valinta).
  const [aimDay, setAimDay] = useState<string | null>(null);
  const choose = Boolean(p.targets?.some((t) => !t.dead));

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError('');
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? 'Jokin meni pieleen.');
    router.refresh();
  }

  // Askelpäivä näyttää ✓:n heti napautuksesta (palvelin vahvistaa taustalla); muut päivät pysyvät napautettavina.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const daysKey = p.days.map((d) => `${d.day}:${d.stepped}`).join();
  useEffect(() => setOptimistic({}), [daysKey]);
  const steppedOf = (d: Day) => optimistic[d.day] ?? d.stepped;

  // Tämän päivän kuittaus vie etusivun alkuun, jossa monsteri ottaa askeleet vastaan (kuten Lyö-valikko);
  // menneiden päivien jälkikuittaus on hiljainen.
  async function stepDay(day: string, on: boolean, target: number | null = null) {
    const live = on && day === today;
    setOptimistic((o) => ({ ...o, [day]: on }));
    setError('');
    const res = await toggleStep(day, on, false, target);
    if (!res.ok) {
      setOptimistic((o) => { const { [day]: _, ...rest } = o; return rest; });
      return setError(res.error ?? 'Jokin meni pieleen.');
    }
    if (live) goStrike(router, stepStrikeQuery(target));
    else router.refresh();
  }

  const pct = p.target > 0 ? Math.min(100, (p.hours / p.target) * 100) : 100;
  const kept = p.target > 0 && p.hours >= p.target;
  // Armonaikakortissa (edellinen viikko) mikään päivä ei ole "tänään".
  const today = p.grace ? undefined : p.days.filter((d) => !d.future).at(-1)?.day;
  const stepCount = p.days.filter((d) => steppedOf(d) && !d.sick).length;
  const sickCount = p.days.filter((d) => d.sick).length;
  const healthyDays = p.days.length - sickCount;
  // Askeltavoite: 5 päivää viikossa (sama arvio kuin HP:ssa), suhteessa terveisiin päiviin. Loput päivät ovat bonusta.
  const stepGoal = Math.round((5 * healthyDays) / 7);
  const stepsOk = stepCount >= stepGoal && stepGoal > 0;
  const shortWeek = p.days.length < 7;

  function tapSick(d: Day) {
    // Tämän päivän merkinnästä kysytään, jatkuuko sairaus (silloin tulevat päivät merkitään automaattisesti).
    if (!d.sick && d.day === today) return setAskContinue(true);
    run(() => toggleSickDay(d.day, !d.sick));
  }

  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 className="display">{p.grace ? `Viikko ${p.week}` : 'Minun viikkoni'}</h2>
        <span className="muted small">{p.grace ? 'Auki tänään klo 12 asti' : `Viikko ${p.week}`}</span>
      </div>
      {p.grace ? <p className="note threat" style={{ margin: 0 }}>⏳ Kuittaa puuttuvat askeleet ja sairaspäivät ennen klo 12. Sen jälkeen viikko {p.week} lukittuu.</p> : null}

      <div className="week-power">
        <strong>⚔️ {p.weekDamage.toLocaleString('fi-FI')} voimaa</strong>
        <span className="muted small">askeleista {p.stepDamage} · yhteistreenejä {p.togetherCount}</span>
      </div>

      <div className="myweek-block">
        <Hint
          id="pledge-hours"
          title={<div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><span className="muted small">Lupaustunnit</span><strong className={kept ? 'ok' : ''} style={{ fontSize: 22 }}>{p.target > 0 ? <>{h(p.hours)} / {h(p.target)}{kept ? ' ✓' : ''}</> : h(p.hours)}</strong></div>}
        >
          Lupaustunnit lasketaan lajin arvolla: tunti useimpia lajeja = 1 h, raskaat lajit (esim. uinti) tuplasti ja kevyet lajit (esim. jooga, liikkuvuus, golf) puolet ajasta. Bonukset eivät kasvata lupaustunteja. Jokaisen iskun kohdalla näkyy, paljonko se kerrytti lupausta.
        </Hint>
        {p.target > 0 ? <div className="hpbar"><span style={{ width: `${pct}%`, background: kept ? 'var(--moss-text)' : 'var(--ember)' }} /></div> : null}
        <span className="muted small">
          {kept ? 'Lupaus pidetty! +100 ensi-iskuun, kun viikko lukittuu.' : p.target === 0 ? '🤒 Vapautettu lupauksesta sairauden vuoksi: viikko ei laske tilastoja eikä katkaise putkea. Kirjatut treenit tuovat silti voimaa.' : `Vielä ${h(p.target - p.hours)}. Pidetty lupaus tuo +100 ensi-iskuun.`}
        </span>
        {shortWeek ? <span className="muted small">Lyhyt viikko ({p.days.length} pv): tavoite on {p.days.length}/7 lupauksestasi ({h(p.pledge)}).</span> : null}
        {p.sickDays ? <span className="small" style={{ color: 'var(--gold)' }}>🤒 {p.sickDays} sairaspäivää: tavoite {h(p.fullTarget)} → {h(p.target)}{p.inSeal ? '' : ' · ei sinettivelvollisuutta tällä viikolla'}</span> : null}
      </div>

      <div className="myweek-block">
        <Hint id="steps" title={<div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}><span className="muted small">Askeleet (10 000 / pv)</span><strong className={stepsOk ? 'ok' : ''}>{stepCount} / {stepGoal} pv{stepsOk ? ' ✓' : ''}{stepCount > stepGoal ? ` +${stepCount - stepGoal} ⭐` : ''}</strong></div>}>
          Napauta päivää, kun olet kävellyt 10 000 askelta: +50. Tavoite on 5 päivää viikossa (vähemmän sairaspäivinä ja lyhyellä viikolla), mutta jokainen päivä tavoitteen yli tuo lisää voimaa. Jos kaikki terveet kuittaavat saman päivän, siitä tulee megamarssi ⭐ +250.
        </Hint>
        <div className="weekstrip" style={{ gridTemplateColumns: `repeat(${p.days.length}, 1fr)` }}>
          {p.days.map((d) => {
            const [wd, date] = formatDay(d.day).split(' ');
            const stepped = steppedOf(d);
            const state = d.sick ? 'sickday' : stepped ? 'done' : d.future ? 'future' : d.day === today ? 'today' : 'missed';
            return (
              <button
                key={d.day}
                type="button"
                className={`daycell ${state}`}
                aria-pressed={stepped}
                aria-label={`${formatDay(d.day)}: ${d.sick ? 'sairaspäivä' : stepped ? 'askeleet kuitattu' : d.future ? 'tulossa' : 'ei kuitattu'}${d.patrol ? ', megamarssi' : ''}`}
                disabled={d.future || d.sick || busy}
                onClick={() => (!stepped && choose ? setAimDay(d.day) : void stepDay(d.day, !stepped))}
              >
                <span>{wd}</span>
                <b>{d.sick ? '🤒' : d.patrol ? '⭐' : stepped ? '✓' : date.replace(/\.$/, '').split('.')[0]}</b>
              </button>
            );
          })}
        </div>
        {aimDay && p.targets ? (
          <div className="sick-box">
            <strong>Ketä lyöt askeleilla ({formatDay(aimDay)})?</strong>
            <TargetChoice targets={p.targets} selected={null} disabled={busy} onPick={(i) => { const d = aimDay; setAimDay(null); writeTarget(i); void stepDay(d, true, i); }} />
            <button type="button" className="linklike small" onClick={() => setAimDay(null)}>Peru</button>
          </div>
        ) : null}
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
