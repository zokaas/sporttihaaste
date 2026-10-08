import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import ShareRecap from '@/components/ShareRecap';
import { requireHero } from '@/lib/page';
import { midseason, midseasonText } from '@/lib/midseason';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('fi-FI');

export default async function Puolivali() {
  const { battle: b } = await requireHero();
  const m = midseason(b);
  if (!m) notFound();
  const text = midseasonText(m);
  return (
    <>
      <Nav current="/" />
      <h1 className="display">Kausi puolivälissä</h1>
      <section className="card">
        <h2 className="display">💀 {m.killed.length}/{m.monsters} monsteria kaatui</h2>
        {m.killed.length ? <p style={{ margin: 0 }}>{m.killed.join(', ')}</p> : null}
        {m.survived.map((s) => <p key={s.name} className="note threat" style={{ margin: 0 }}>😈 Rästissä: {s.name} ({fmt(s.hp)} HP)</p>)}
      </section>
      <section className="card">
        <h2 className="display">Porukan luvut</h2>
        <ul className="people">
          <li><div className="grow"><div className="who">💥 {fmt(m.damage)} voimaa</div><div className="facts">{m.trainings} treeniä · {m.stepDays} askelpäivää{m.patrols ? ` · ${m.patrols} megamarssia` : ''}</div></div></li>
          <li><div className="grow"><div className="who">🤝 {m.pledgesKept}/{m.pledgesTotal} lupausta pidetty</div></div></li>
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
      <p className="muted" style={{ margin: 0, textAlign: 'center' }}>{m.weeksLeft} viikkoa jäljellä. Loppupomo odottaa.</p>
      <section className="card">
        <h2 className="display">Jaa porukalle</h2>
        <pre className="share-text">{text}</pre>
        <ShareRecap text={text} />
      </section>
    </>
  );
}
