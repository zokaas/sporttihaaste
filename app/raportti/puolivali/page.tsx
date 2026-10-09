import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import BackButton from '@/components/BackButton';
import ShareRecap from '@/components/ShareRecap';
import { requireHero } from '@/lib/page';
import { MID_DAY, midseason, midseasonText } from '@/lib/midseason';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('fi-FI');

export default async function Puolivali() {
  const { battle: b, me, user } = await requireHero();
  // Ylläpitäjä näkee raportin etukäteen (tähänastisilla luvuilla), muut pe 6.11. alkaen.
  const m = midseason(b, Boolean(me.is_admin), user.id);
  if (!m) notFound();
  const text = midseasonText(m);
  return (
    <>
      <Nav current="/" />
      <BackButton fallback="/" />
      <h1 className="display">Kausi puolivälissä</h1>
      {m.preview ? <p className="note threat" style={{ margin: 0 }}>Esikatselu ylläpitäjälle: muut näkevät raportin pe {Number(MID_DAY.slice(8))}.{Number(MID_DAY.slice(5, 7))}. alkaen. Luvut ovat tähänastiset.</p> : null}
      <p className="muted small" style={{ margin: 0 }}>Luvut kauden alusta {Number(m.until.slice(8))}.{Number(m.until.slice(5, 7))}. asti.</p>
      <section className="card">
        <h2 className="display">💀 {m.killed.length}/{m.started} monsteria kaatui</h2>
        {m.killed.length ? <p style={{ margin: 0 }}>{m.killed.join(', ')}</p> : null}
        {m.standing.map((s) => <p key={s.name} className={`note${s.current ? '' : ' threat'}`} style={{ margin: 0 }}>{s.current ? `⚔️ Taistelu käynnissä: ${s.name}` : `😈 Rästissä: ${s.name}`}</p>)}
      </section>
      <section className="card">
        <h2 className="display">Porukan luvut</h2>
        <ul className="people">
          <li><div className="grow"><div className="who">💥 {fmt(m.damage)} voimaa</div><div className="facts">{m.trainings} treeniä · askeleet kuitattu {m.stepDays} kertaa{m.patrols ? ` · ${m.patrols} megamarssia` : ''}</div></div></li>
          {m.pledgesTotal ? <li><div className="grow"><div className="who">🤝 {m.pledgesKept}/{m.pledgesTotal} lupausta pidetty</div><div className="facts">päättyneiltä viikoilta</div></div></li> : null}
          {m.jointTrainings ? <li><div className="grow"><div className="who">👥 {m.jointTrainings} yhteistreeniä</div></div></li> : null}
          <li><div className="grow"><div className="who">⚔️ Ensi-isku loppupomolle: {fmt(m.pot)}</div></div></li>
        </ul>
      </section>
      {m.top.length ? (
        <section className="card">
          <h2 className="display">🏆 Kärki</h2>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {m.top.map((t) => <li key={t.name}><strong>{t.name}</strong> · {fmt(t.damage)} voimaa</li>)}
          </ol>
          {m.stepKing ? <p className="muted small" style={{ margin: 0 }}>👣 Askelkuningas: {m.stepKing.name} ({m.stepKing.days} päivää)</p> : null}
        </section>
      ) : null}
      {m.own ? (
        <section className="card">
          <h2 className="display">Sinun kautesi tähän asti</h2>
          <div className="stat-row">
            <div className="stat"><span className="muted small">Voima</span><strong>{fmt(m.own.damage)}</strong><span className="muted small">sija {m.own.rank}/{m.own.of}</span></div>
            <div className="stat"><span className="muted small">Treenit</span><strong>{m.own.trainings}</strong></div>
          </div>
          <div className="stat-row">
            <div className="stat"><span className="muted small">Lupaukset</span><strong>{m.own.kept}/{m.own.closed}</strong></div>
            <div className="stat"><span className="muted small">Askeleet kuitattu</span><strong>{m.own.stepDays} kertaa</strong></div>
          </div>
          {m.own.bestHit ? <p style={{ margin: 0 }}>Paras iskusi: {m.own.bestHit.sport} {m.own.bestHit.minutes} min, <strong>{fmt(m.own.bestHit.damage)}</strong> voimaa.</p> : null}
          {m.own.badges.length ? (
            <div className="badges">
              {m.own.badges.map((a, i) => (
                <div key={i} className="badge"><span className="icon" aria-hidden="true">{a.short ?? a.icon}</span><div><strong>{a.title}</strong><div className="muted small">{a.detail}</div></div></div>
              ))}
            </div>
          ) : <p className="muted small" style={{ margin: 0 }}>Ei vielä merkkejä. Toinen puolisko on edessä!</p>}
        </section>
      ) : null}
      {m.badges.length ? (
        <section className="card">
          <h2 className="display">🎖️ Merkit tähän mennessä</h2>
          <ul className="people">
            {m.badges.map((x) => (
              <li key={x.name}><div className="grow" style={{ minWidth: 0 }}><div className="who">{x.name}</div></div><span style={{ whiteSpace: 'nowrap' }}>{x.shorts.join(' ')}</span></li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="muted" style={{ margin: 0, textAlign: 'center' }}>{m.daysLeft} päivää jäljellä. Loppupomo odottaa.</p>
      <section className="card">
        <h2 className="display">Jaa porukalle</h2>
        <pre className="share-text">{text}</pre>
        <ShareRecap text={text} />
      </section>
    </>
  );
}
