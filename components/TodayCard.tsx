import type { Battle } from '@/lib/stats';
import { upcomingCelebrations } from '@/lib/stats';
import { formatDay } from '@/lib/season';
import { isSickOn } from '@/lib/weekly';
import { weaknessesOf } from '@/lib/trio';

/** Tänään: viikon heikkous, päivän juhlapäivä (tai seuraava) ja päivän partiotilanne. */
export default function TodayCard({ b }: { b: Battle }) {
  const weakness = weaknessesOf(b.monsters.get(b.week)).join(', ');
  const celebrations = upcomingCelebrations(b, 60);
  const todays = celebrations.filter((c) => c.day === b.today);
  const next = celebrations.find((c) => c.day > b.today);
  const healthy = b.participants.filter((u) => !isSickOn(b.periods, u, b.today));
  const stepped = new Set(b.steps.filter((s) => s.day === b.today).map((s) => s.user_id));
  const missing = healthy.filter((u) => !stepped.has(u)).map((u) => b.heroes.find((h) => h.id === u)?.hero_name).filter(Boolean);
  const patrol = b.patrols.some((p) => p.day === b.today);

  return (
    <section className="card">
      <h2 className="display">Tänään {formatDay(b.today)}</h2>
      {weakness ? <div className="row"><span aria-hidden="true">🎯</span><span>Viikon heikkous: <strong>{weakness}</strong> (+50 %)</span></div> : null}
      {todays.length ? (
        <div className="row"><span aria-hidden="true">🎉</span><span><strong>{todays.map((c) => `${c.name} (${c.kind})`).join(', ')}</strong>: kaikkien iskut tänään +50 %!</span></div>
      ) : next ? (
        <div className="row"><span aria-hidden="true">🎂</span><span className="muted">Seuraava juhlapäivä {formatDay(next.day)}: {next.name}</span></div>
      ) : null}
      <div className="row">
        <span aria-hidden="true">{patrol ? '⭐' : '👣'}</span>
        <span>
          {patrol ? <strong className="ok">Partiopäivä! Kaikki terveet kuittasivat askeleet (+250).</strong>
            : <>Askeleet {stepped.size}/{healthy.length}.{stepped.size ? <> Kuitanneet: {[...stepped].map((u) => b.heroes.find((h) => h.id === u)?.hero_name).filter(Boolean).join(', ')}.</> : null} {missing.length ? <span className="muted">Puuttuu: {missing.join(', ')}</span> : null}</>}
        </span>
      </div>
    </section>
  );
}
