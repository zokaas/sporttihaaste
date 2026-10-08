import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import ShareRecap from '@/components/ShareRecap';
import { requireHero } from '@/lib/page';
import { MID_DAY, midseason, midseasonText } from '@/lib/midseason';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('fi-FI');

export default async function Puolivali() {
  const { battle: b, me } = await requireHero();
  // Ylläpitäjä näkee raportin etukäteen (tähänastisilla luvuilla), muut pe 6.11. alkaen.
  const m = midseason(b, Boolean(me.is_admin));
  if (!m) notFound();
  const text = midseasonText(m);
  return (
    <>
      <Nav current="/" />
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
          <li><div className="grow"><div className="who">💥 {fmt(m.damage)} voimaa</div><div className="facts">{m.trainings} treeniä · {m.stepDays} askelpäivää{m.patrols ? ` · ${m.patrols} megamarssia` : ''}</div></div></li>
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
      <p className="muted" style={{ margin: 0, textAlign: 'center' }}>{m.daysLeft} päivää jäljellä. Loppupomo odottaa.</p>
      <section className="card">
        <h2 className="display">Jaa porukalle</h2>
        <pre className="share-text">{text}</pre>
        <ShareRecap text={text} />
      </section>
    </>
  );
}
