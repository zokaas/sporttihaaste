import Link from 'next/link';
import Nav from '@/components/Nav';
import { requireHero } from '@/lib/page';
import { avatarUrl } from '@/lib/supabase/client';
import { heroStats, rankByPledges, upcomingCelebrations } from '@/lib/stats';
import { addDays, formatDay, seasonWeek, weekRange, BOSS_WEEK } from '@/lib/season';
import { isSickOn } from '@/lib/weekly';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'lupaukset', label: 'Lupaukset' },
  { key: 'vahinko', label: 'Voima' },
  { key: 'askeleet', label: 'Askeleet' },
] as const;

const fmt = (n: number) => n.toLocaleString('fi-FI');

export default async function Sankarit({ searchParams }: { searchParams: { tab?: string } }) {
  const { battle: b, user } = await requireHero();
  const tab = TABS.find((t) => t.key === searchParams.tab)?.key ?? 'lupaukset';
  const stats = heroStats(b, avatarUrl);
  const ranked =
    tab === 'vahinko' ? [...stats].sort((a, c) => c.damage - a.damage)
    : tab === 'askeleet' ? [...stats].sort((a, c) => c.stepDays - a.stepDays || c.longestStreak - a.longestStreak)
    : rankByPledges(stats);

  const inSeason = seasonWeek(b.today) >= 1 && seasonWeek(b.today) <= BOSS_WEEK;
  const { start, end } = weekRange(b.week);
  const days: string[] = [];
  for (let d = start; d <= end && d <= b.today; d = addDays(d, 1)) days.push(d);
  const joint = b.hits.filter((h) => seasonWeek(h.trained_on) === b.week && h.companions.length >= 2).length;
  const celebrations = upcomingCelebrations(b, 14);

  return (
    <>
      <Nav current="/sankarit" />
      <h1 className="display">Sankarit</h1>

      {inSeason ? (
        <section className="card">
          <h2 className="display">Porukan viikko {b.week}</h2>
          {days.length ? (
            <>
              <div className="grid-days" style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 7)}, minmax(0, 1fr))` }}>
                {days.map((d) => {
                  const healthy = b.participants.filter((u) => !isSickOn(b.periods, u, d));
                  const stepped = healthy.filter((u) => b.steps.some((s) => s.user_id === u && s.day === d)).length;
                  const trained = new Set(b.hits.filter((h) => h.trained_on === d).map((h) => h.user_id)).size;
                  const patrol = b.patrols.some((p) => p.day === d);
                  return (
                    <div key={d} className={`cell${patrol ? ' full' : ''}`} title={`${formatDay(d)}: ${trained} treenasi, askeleet ${stepped}/${healthy.length}`}>
                      <div>{formatDay(d).split(' ')[0]}</div>
                      <div>⚔️{trained}</div>
                      <div>{patrol ? '⭐' : healthy.length ? `👣${stepped}/${healthy.length}` : '🤒'}</div>
                    </div>
                  );
                })}
              </div>
              <table className="plain step-matrix">
                <thead>
                  <tr><th>Sankari</th>{days.map((d) => <th key={d}>{formatDay(d).split(' ')[0]}</th>)}</tr>
                </thead>
                <tbody>
                  {b.participants.map((u) => (
                    <tr key={u}>
                      <td>{b.heroes.find((h) => h.id === u)?.hero_name}</td>
                      {days.map((d) => {
                        const done = b.steps.some((s) => s.user_id === u && s.day === d);
                        const sick = isSickOn(b.periods, u, d);
                        const trained = b.hits.some((h) => h.user_id === u && h.trained_on === d);
                        return (
                          <td key={d} title={`${formatDay(d)}${trained ? ' · treeni' : ''}${done ? ' · askeleet' : ''}${sick ? ' · kipeä' : ''}`}>
                            <span className={`mcell${trained ? ' trained' : ''}`}>{sick && !trained && !done ? '🤒' : done ? '✓' : trained ? '' : '·'}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small" style={{ margin: 0 }}><span className="mcell trained legend">&nbsp;</span> treenasi · ✓ askeleet · 🤒 kipeä</p>
            </>
          ) : null}
          <div className="stat-row">
            <div className="stat"><span className="muted small">Megamarssit</span><strong>{b.patrols.filter((p) => seasonWeek(p.day) === b.week).length}</strong></div>
            <div className="stat"><span className="muted small">Yhteistreenit</span><strong>{joint}</strong></div>
          </div>
        </section>
      ) : null}

      {celebrations.length ? (
        <section className="card">
          <h2 className="display">Tulevat juhlapäivät</h2>
          <p className="muted small" style={{ margin: 0 }}>Juhlapäivänä kaikkien iskut tekevät +50 %.</p>
          {celebrations.map((c) => (
            <p key={c.day + c.name + c.kind} style={{ margin: 0 }}>🎉 {formatDay(c.day)} {c.name}, {c.kind}</p>
          ))}
        </section>
      ) : null}

      <section className="card">
        <div className="tabs" role="tablist" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {TABS.map((t) => (
            // Välilehden vaihto ei vieritä sivua eikä kasvata selaimen historiaa.
            <Link key={t.key} role="tab" aria-selected={tab === t.key} href={`/sankarit?tab=${t.key}`} scroll={false} replace className="tab-link">{t.label}</Link>
          ))}
        </div>
        <ul className="people">
          {ranked.map((s, i) => (
            <li key={s.id}>
              <span className="rank">{i + 1}.</span>
              <Link href={`/sankari/${s.id}`} className="rowlink row grow" style={{ alignItems: 'center', minWidth: 0 }}>
                {s.avatar ? <img className="avatar" src={s.avatar} alt="" width={40} height={40} /> : <div className="avatar" style={{ width: 40, height: 40 }}>{s.name.slice(0, 1)}</div>}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{s.name}{s.id === user.id ? ' (sinä)' : ''}</div>
                  <div className="facts">
                    {tab === 'lupaukset' ? `${s.pledgesKept}/${s.closedWeeks} lupausta pidetty · ${fmt(s.damage)} voimaa`
                      : tab === 'vahinko' ? `${fmt(s.damage)} voimaa · ${s.hitCount} iskua`
                      : `${s.stepDays} askelpäivää · pisin putki ${s.longestStreak}`}
                  </div>
                </div>
                {s.achievements.length ? <span title="Saavutukset">{s.achievements.slice(0, 3).map((a) => a.icon).join('')}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
        {tab === 'lupaukset' ? <p className="muted small" style={{ margin: 0 }}>Ykkönen on se, joka pitää lupauksensa useimmin. Tasatilanteessa ratkaisee voima.</p> : null}
      </section>
    </>
  );
}
