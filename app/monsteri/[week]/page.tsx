import Link from 'next/link';
import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import MonsterStage from '@/components/MonsterStage';
import { requireHero } from '@/lib/page';
import { avatarUrl, monsterImageUrl } from '@/lib/supabase/client';
import { finalBlows } from '@/lib/stats';
import { STEP_DAY_DAMAGE } from '@/lib/rules';
import { formatDay, seasonWeek, weekRange, BOSS_WEEK } from '@/lib/season';
import { stageParts, weaknessesOf } from '@/lib/trio';
import Hint from '@/components/Hint';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('fi-FI');
const helsinki = (ms: number, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', ...opts }).format(new Date(ms));

export default async function Monsteri({ params }: { params: { week: string } }) {
  const { battle: b } = await requireHero();
  const week = Number(params.week);
  if (!Number.isInteger(week) || week < 1 || week > BOSS_WEEK || week > b.week) notFound();

  const m = b.monsters.get(week);
  const title = m?.name ?? (week === BOSS_WEEK ? 'Loppupomo' : `Viikon ${week} monsteri`);
  const fighter = b.ledger?.alive.find((f) => f.week === week);
  const killed = b.ledger?.killed.find((k) => k.week === week);
  const blow = finalBlows(b)[week];
  const heroName = (id: string) => b.heroes.find((h) => h.id === id)?.hero_name ?? 'Partio';
  const { start, end } = weekRange(week);
  const weak = weaknessesOf(m).join(', ');
  const parts = stageParts(m, killed ? 0 : fighter?.hp ?? m?.hp ?? 0, Boolean(killed), monsterImageUrl);

  // Vahinko monsterin viikolla (iskut + askeleet) sankareittain
  const totals = new Map<string, number>();
  for (const h of b.hits) if (seasonWeek(h.trained_on) === week) totals.set(h.user_id, (totals.get(h.user_id) ?? 0) + h.damage);
  for (const s of b.steps) if (seasonWeek(s.day) === week) totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + STEP_DAY_DAMAGE);
  const top = [...totals].sort((a, c) => c[1] - a[1]).slice(0, 5);
  const hits = b.hits.filter((h) => seasonWeek(h.trained_on) === week).sort((a, c) => c.created_at.localeCompare(a.created_at));

  return (
    <>
      <Nav current="/bestiaario" />
      <MonsterStage
        week={week}
        title={title}
        image={monsterImageUrl(m?.image_path)}
        weakness={weak || null}
        parts={parts}
        hp={killed ? 0 : fighter ? (fighter.padded ? 0 : fighter.hp) : m?.hp ?? 0}
        maxHp={m?.hp ?? 1}
        padded={fighter?.padded ?? 0}
        backlog={week < b.week && !killed}
        revealed={Boolean(m?.name)}
        dead={Boolean(killed)}
        ownHit={null}
      />
      {m?.description ? <p className="narrator">{m.description}</p> : null}

      {parts && m?.parts ? (
        <section className="card">
          <h2 className="display">Kolmikko</h2>
          <Hint id="trio">Kolme osaa jakavat viikon HP:n tasan ja kaatuvat järjestyksessä. Viimeinen kaatuu vasta, kun sinetti on täynnä.</Hint>
          <ul className="people">
            {m.parts.map((part, i) => (
              <li key={i} style={parts[i].dead ? { opacity: 0.6 } : undefined}>
                {parts[i].image ? <img className="avatar" src={parts[i].image!} alt="" width={56} height={56} style={parts[i].dead ? { filter: 'grayscale(1)' } : undefined} /> : <div className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>{parts[i].dead ? '✝' : i + 1}</div>}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{part.name}</div>
                  <div className="facts">{parts[i].dead ? <span className="ok">Kaatunut</span> : `${fmt(parts[i].left)} / ${fmt(parts[i].hp)} HP`}{part.weakness ? ` · heikkous ${part.weakness}` : ''}</div>
                  {part.description ? <div className="facts">{part.description}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Viikko</span><span>{week} · {formatDay(start)}–{formatDay(end)}</span></div>
        {weak ? <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Heikkous</span><span>{weak} (+50 %)</span></div> : null}
        <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Tila</span>
          <span>{killed?.killedAt ? <span className="ok">Kaatui {helsinki(killed.killedAt, { weekday: 'short', day: 'numeric', month: 'numeric' })}</span>
            : fighter?.padded ? <span style={{ color: 'var(--gold)' }}>HP 0, {fmt(fighter.padded)} padottuna</span>
            : fighter ? `${fmt(fighter.hp)} / ${fmt(m?.hp ?? 0)} HP` : '–'}</span>
        </div>
        {blow ? <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted">Viimeinen isku</span><Link href={`/sankari/${blow}`}>⚔️ {heroName(blow)}</Link></div> : null}
      </section>

      {top.length ? (
        <section className="card">
          <h2 className="display">Eniten vahinkoa</h2>
          <ul className="people">
            {top.map(([id, dmg], i) => {
              const h = b.heroes.find((x) => x.id === id);
              const src = avatarUrl(h?.avatar_path ?? null);
              return (
                <li key={id}>
                  <span className="rank">{i + 1}.</span>
                  <Link href={`/sankari/${id}`} className="rowlink row grow" style={{ alignItems: 'center' }}>
                    {src ? <img className="avatar" src={src} alt="" width={36} height={36} /> : <div className="avatar" style={{ width: 36, height: 36 }}>{(h?.hero_name ?? '?').slice(0, 1)}</div>}
                    <span className="grow who">{h?.hero_name}</span>
                    <strong>{fmt(dmg)}</strong>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <h2 className="display">Iskut</h2>
        {hits.length ? (
          <ul className="people">
            {hits.map((h, i) => (
              <li key={i}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{heroName(h.user_id)} <span className="muted" style={{ fontWeight: 400 }}>· {h.sport} {h.minutes} min</span></div>
                  <div className="facts">
                    {formatDay(h.trained_on)}
                    {h.companions.length ? ` · ${h.companions.length + 1} hengen porukka` : ''}
                    {h.all_together ? ' · kaikki yhdessä!' : ''}
                  </div>
                </div>
                <strong>{fmt(h.damage)}</strong>
              </li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>Kukaan ei ole vielä lyönyt.</p>}
      </section>
    </>
  );
}
