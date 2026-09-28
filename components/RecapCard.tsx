import type { WeekRecap } from '@/lib/stats';
import { formatDay } from '@/lib/season';

const fmt = (n: number) => n.toLocaleString('fi-FI');

/** Päättyneen viikon tulos korttina. */
export default function RecapCard({ r }: { r: WeekRecap }) {
  return (
    <div className="recap">
      <span className="recap-kicker">Viikko {r.week} päättyi</span>
      {r.killed.length ? <h2 className="display recap-title ok">💀 {r.killed.join(' ja ')} kaatui!</h2> : null}
      {r.survived.map((s) => <h2 key={s.name} className="display recap-title" style={{ color: 'var(--blood-text)' }}>😈 {s.name} jäi henkiin</h2>)}
      <div className="stat-row">
        <div className="stat"><span className="muted small">Voimaa</span><strong>{fmt(r.damage)}</strong><span className="muted small">bonuksista {r.bonusShare} %</span></div>
        <div className="stat"><span className="muted small">Potti</span><strong>+{fmt(r.potGain)}</strong><span className="muted small">yhteensä {fmt(r.pot)}</span></div>
      </div>
      {r.lostToSeal ? <p className="note threat" style={{ margin: 0 }}>🛡️ Sinetti jäi vajaaksi: {fmt(r.lostToSeal)} voimaa sinettirajan yli menetettiin.</p> : null}
      {r.mvp ? <p style={{ margin: 0 }}>🏆 Viikon sankari: <strong>{r.mvp.name}</strong> ({fmt(r.mvp.damage)})</p> : null}
      <p style={{ margin: 0 }}>🤝 Lupauksen piti {r.pledgesKept}/{r.participants}</p>
      <p style={{ margin: 0 }}>👣 Askelpäiviä {r.stepDays}, megamarsseja {r.patrolDays} · yhteistreenejä {r.jointTrainings}</p>
      {r.celebrationsNext.length ? <p style={{ margin: 0 }}>🎉 Tulossa: {r.celebrationsNext.map((c) => `${formatDay(c.day)} ${c.name}`).join(', ')}</p> : null}
    </div>
  );
}
