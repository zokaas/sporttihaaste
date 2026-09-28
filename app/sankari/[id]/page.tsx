import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import Nav from '@/components/Nav';
import { requireHero } from '@/lib/page';
import { avatarUrl } from '@/lib/supabase/client';
import { heroStats, rankByPledges, type HeroStats } from '@/lib/stats';
import { formatDay, seasonWeek } from '@/lib/season';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('fi-FI');
const h = (n: number) => `${String(Math.round(n * 10) / 10).replace('.', ',')} h`;
const dm = (v: string | null) => (v ? `${Number(v.slice(3, 5))}.${Number(v.slice(0, 2))}.` : '–');

export default async function Sankari({ params }: { params: { id: string } }) {
  const { battle: b, user } = await requireHero();
  const stats = heroStats(b, avatarUrl);
  const ranked = rankByPledges(stats);
  const s = stats.find((x) => x.id === params.id);
  const hero = b.heroes.find((x) => x.id === params.id);
  if (!s || !hero) notFound();
  const mine = stats.find((x) => x.id === user.id);
  const self = params.id === user.id;
  const rank = ranked.findIndex((x) => x.id === s.id) + 1;
  const weekHits = b.hits.filter((x) => x.user_id === s.id && seasonWeek(x.trained_on) === b.week).sort((a, c) => c.trained_on.localeCompare(a.trained_on));
  const status = b.pledgeStatus(s.id, b.week);

  const rows: [string, (x: HeroStats) => string][] = [
    ['Voima', (x) => fmt(x.damage)],
    ['Iskut', (x) => String(x.hitCount)],
    ['Treenitunnit (lupaukseen)', (x) => h(x.hours)],
    ['Pidetyt lupaukset', (x) => `${x.pledgesKept}/${x.closedWeeks}`],
    ['Askelpäivät', (x) => String(x.stepDays)],
    ['Pisin askelputki', (x) => String(x.longestStreak)],
  ];

  return (
    <>
      <Nav current="/sankarit" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
        {s.avatar ? <img className="avatar" src={s.avatar} alt="" width={112} height={112} /> : <div className="avatar" style={{ width: 112, height: 112, fontSize: 40 }}>{s.name.slice(0, 1)}</div>}
        <h1 className="display" style={{ overflowWrap: 'anywhere' }}>{s.name}</h1>
        <span className="muted">Sija {rank}/{stats.length} · lupaus {h(b.pledgeOf(s.id, b.week))} viikossa{b.sickNow.includes(s.id) ? ' · kipeänä' : ''}</span>
      </div>

      <section className="card">
        <h2 className="display">Tällä viikolla</h2>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Lupaus</span><span className={status.kept ? 'ok' : ''}>{h(status.hours)} / {h(status.target)}{status.kept ? ' ✓' : ''}</span></div>
        {weekHits.length ? weekHits.map((x, i) => (
          <div key={i} className="row" style={{ justifyContent: 'space-between' }}>
            <span>{formatDay(x.trained_on)} {x.sport} {x.minutes} min{x.companions.length ? ` · ${x.companions.length + 1} hengen porukka` : ''}</span>
            <strong>{x.damage}</strong>
          </div>
        )) : <p className="muted" style={{ margin: 0 }}>Ei vielä iskuja tällä viikolla.</p>}
      </section>

      <section className="card">
        <h2 className="display">Kausi</h2>
        <div className="compare">
          <span />
          <span className="head">{self ? '' : s.name.split(' ')[0]}</span>
          <span className="head">{self || !mine ? '' : 'Sinä'}</span>
          {rows.map(([label, get]) => (
            <Fragment key={label}>
              <span>{label}</span>
              <strong>{get(s)}</strong>
              <span className="muted">{self || !mine ? '' : get(mine)}</span>
            </Fragment>
          ))}
        </div>
      </section>

      {s.favourites.length ? (
        <section className="card">
          <h2 className="display">Suosikkilajit</h2>
          {s.favourites.map((f) => <div key={f.sport} className="row" style={{ justifyContent: 'space-between' }}><span>{f.sport}</span><span className="muted">{f.count} kertaa</span></div>)}
        </section>
      ) : null}

      <section className="card">
        <h2 className="display">Saavutukset</h2>
        {s.achievements.length ? (
          <div className="badges">
            {s.achievements.map((a, i) => (
              <div key={i} className="badge"><span className="icon" aria-hidden="true">{a.icon}</span><div><strong>{a.title}</strong><div className="muted small">{a.detail}</div></div></div>
            ))}
          </div>
        ) : <p className="muted" style={{ margin: 0 }}>Ei vielä saavutuksia. Viikon sankari, viimeinen isku, askelputket ja pidetyt lupaukset tuovat niitä.</p>}
      </section>

      <section className="card">
        <h2 className="display">Juhlapäivät</h2>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Syntymäpäivä</span><span>{dm(hero.birthday)}</span></div>
        <div className="row" style={{ justifyContent: 'space-between' }}><span>Nimipäivä</span><span>{dm(hero.name_day)}</span></div>
      </section>
    </>
  );
}
