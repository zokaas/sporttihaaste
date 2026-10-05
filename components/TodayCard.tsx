import Link from 'next/link';
import type { Battle } from '@/lib/stats';
import { upcomingCelebrations } from '@/lib/stats';
import { BOSS_WEEK, formatDay, weekRange } from '@/lib/season';
import { isSickOn } from '@/lib/weekly';
import { avatarUrl } from '@/lib/supabase/client';
import { weekDifficulty } from '@/lib/outlook';
import { activeWeaknesses } from '@/lib/trio';

/** Tänään: päivän askeltilanne ja juhlapäivä. Tulevat juhlapäivät ilmoitetaan viikkoa etukäteen. */
export default function TodayCard({ b, showNextReveal = true }: { b: Battle; showNextReveal?: boolean }) {
  const celebrations = upcomingCelebrations(b, 8);
  const todays = celebrations.filter((c) => c.day === b.today);
  const soon = celebrations.filter((c) => c.day > b.today);
  const healthy = b.participants.filter((u) => !isSickOn(b.periods, u, b.today));
  const stepped = new Set(b.steps.filter((s) => s.day === b.today).map((s) => s.user_id));
  const people = b.participants.map((u) => {
    const h = b.heroes.find((x) => x.id === u);
    return { id: u, name: h?.hero_name ?? '?', avatar: avatarUrl(h?.avatar_path), done: stepped.has(u), sick: !healthy.includes(u) };
  });
  const patrol = b.patrols.some((p) => p.day === b.today);
  // Viikon vaikeus: kuinka moni treeni kymmenestä tarvitsee bonuksen, jotta viikon monsteri kaatuu.
  const difficulty = b.ledger ? weekDifficulty(b) : null;
  const weak = activeWeaknesses(b.monsters.get(b.week), b.monsters.get(b.week)?.hp ?? 0).join(', ');

  return (
    <section className="card">
      <h2 className="display">Tänään {formatDay(b.today)}</h2>
      {difficulty ? (
        <div className={`row difficulty ${difficulty.level}`}>
          <span aria-hidden="true">{difficulty.level === 'easy' ? '🟢' : difficulty.level === 'medium' ? '🟡' : '🔴'}</span>
          <span>
            <strong>{difficulty.level === 'easy' ? 'Helppo viikko' : difficulty.level === 'medium' ? 'Keskivaikea viikko' : 'Vaikea viikko'}</strong>
            {' · '}
            {difficulty.level === 'easy'
              ? 'Lupaukset ja askeleet riittävät.'
              : difficulty.level === 'medium'
                ? 'Tarvitaan bonustreenejä.'
                : `Tarvitaan paljon bonustreenejä ja lisätreeniä. Yhteistreenit${weak ? ` ja ${weak}` : ''} auttavat eniten.`}
            {difficulty.tenths > 0 ? <>{' '}<Link href="/mina" className="nowrap">Porukan lisävoima →</Link></> : null}
          </span>
        </div>
      ) : null}
      {/* Uusi monsteri paljastuu aina maanantaina, sen kaikki tietävät. Loppupomon viikolla muistutetaan kauden päättymisestä. */}
      {showNextReveal && b.week >= BOSS_WEEK ? <div className="row"><span aria-hidden="true">🏁</span><span className="muted">Kausi päättyy <strong style={{ color: 'var(--text)' }}>{formatDay(weekRange(BOSS_WEEK).end)}</strong>, kirjaukset ma klo 12 asti</span></div> : null}
      {todays.length ? (
        <div className="row celebration-today"><span aria-hidden="true">🎉</span><span><strong>{todays.map((c) => `${c.name} (${c.kind})`).join(', ')}</strong>: kaikkien iskut tänään +50 %!</span></div>
      ) : null}
      <div className="row" style={{ alignItems: 'center' }}>
        <span aria-hidden="true">{patrol ? '⭐' : '👣'}</span>
        {patrol ? <strong className="ok">Megamarssi! Kaikki terveet kuittasivat askeleet (+250).</strong> : <span>Askeleet <strong>{stepped.size}/{healthy.length}</strong></span>}
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
      {soon.length ? (
        <div className="row soon-celebration">
          <span aria-hidden="true">🎂</span>
          <span>Tulossa <strong>{formatDay(soon[0].day)}</strong>: {soon.filter((c) => c.day === soon[0].day).map((c) => `${c.name} (${c.kind})`).join(', ')}. Kaikkien iskut silloin +50 %. Suunnittele yhteistreeni sille päivälle!</span>
        </div>
      ) : null}
    </section>
  );
}
