import type { Battle } from '@/lib/stats';
import { upcomingCelebrations } from '@/lib/stats';
import { formatDay } from '@/lib/season';
import { isSickOn } from '@/lib/weekly';
import { weaknessesOf } from '@/lib/trio';
import { avatarUrl } from '@/lib/supabase/client';

/** Tänään: viikon heikkous, päivän juhlapäivä (tai seuraava) ja päivän partiotilanne. */
export default function TodayCard({ b }: { b: Battle }) {
  const weakness = weaknessesOf(b.monsters.get(b.week)).join(', ');
  const celebrations = upcomingCelebrations(b, 60);
  const todays = celebrations.filter((c) => c.day === b.today);
  const next = celebrations.find((c) => c.day > b.today);
  const healthy = b.participants.filter((u) => !isSickOn(b.periods, u, b.today));
  const stepped = new Set(b.steps.filter((s) => s.day === b.today).map((s) => s.user_id));
  const people = b.participants.map((u) => {
    const h = b.heroes.find((x) => x.id === u);
    return { id: u, name: h?.hero_name ?? '?', avatar: avatarUrl(h?.avatar_path), done: stepped.has(u), sick: !healthy.includes(u) };
  });
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
      <div className="row" style={{ alignItems: 'center' }}>
        <span aria-hidden="true">{patrol ? '⭐' : '👣'}</span>
        {patrol ? <strong className="ok">Partiopäivä! Kaikki terveet kuittasivat askeleet (+250).</strong> : <span>Askeleet <strong>{stepped.size}/{healthy.length}</strong></span>}
      </div>
      {!patrol ? (
        <div className="step-dots" aria-label={`Kuitanneet: ${people.filter((p) => p.done).map((p) => p.name).join(', ') || 'ei vielä kukaan'}`}>
          {people.map((p) => (
            <span key={p.id} className={`step-dot${p.done ? ' done' : ''}${p.sick ? ' sick' : ''}`} title={`${p.name}${p.done ? ' ✓' : p.sick ? ' (kipeä)' : ''}`}>
              {p.avatar ? <img src={p.avatar} alt="" /> : p.name.slice(0, 1)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
