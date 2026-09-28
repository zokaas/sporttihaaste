import Link from 'next/link';
import Nav from '@/components/Nav';
import MyWeek from '@/components/MyWeek';
import PushToggle from '@/components/PushToggle';
import DeleteHitButton from '@/components/DeleteHitButton';
import { requireHero } from '@/lib/page';
import { avatarUrl } from '@/lib/supabase/client';
import { myWeekProps } from '@/lib/myweek';
import { formatDay, seasonWeek, BOSS_WEEK } from '@/lib/season';

export const dynamic = 'force-dynamic';

const duration = (min: number) => [Math.floor(min / 60) ? `${Math.floor(min / 60)} h` : '', min % 60 ? `${min % 60} min` : ''].filter(Boolean).join(' ');

export default async function Mina() {
  const { battle: b, user, me } = await requireHero();
  const img = avatarUrl(me.avatar_path);
  const inSeason = seasonWeek(b.today) >= 1 && seasonWeek(b.today) <= BOSS_WEEK;
  const names = new Map(b.heroes.map((h) => [h.id, h.hero_name ?? '']));
  const myHits = b.hits.filter((h) => h.user_id === user.id && seasonWeek(h.trained_on) === b.week).sort((a, c) => c.trained_on.localeCompare(a.trained_on) || c.created_at.localeCompare(a.created_at));

  return (
    <>
      <Nav current="/mina" />
      <Link href={`/sankari/${user.id}`} className="rowlink row" style={{ alignItems: 'center' }}>
        {img ? <img className="avatar" src={img} alt="" width={64} height={64} /> : <div className="avatar" style={{ width: 64, height: 64 }}>{(me.hero_name ?? '?').slice(0, 1)}</div>}
        <div className="grow" style={{ minWidth: 0 }}>
          <h1 className="display" style={{ fontSize: 28, overflowWrap: 'anywhere' }}>{me.hero_name}</h1>
          <span className="muted">Oma profiili ja saavutukset →</span>
        </div>
      </Link>

      {inSeason ? <MyWeek {...myWeekProps(b, user.id)} /> : (
        <section className="card">
          <h2 className="display">Minun viikkoni</h2>
          <p style={{ margin: 0 }}>Kausi alkaa to 1.10. Silloin täällä näkyy lupauksesi eteneminen, askelkuittaukset ja sairastuminen.</p>
        </section>
      )}

      {inSeason ? (
        <section className="card">
          <h2 className="display">Iskusi viikolla {b.week}</h2>
          {myHits.length ? (
            <ul className="people">
              {myHits.map((h) => (
                <li key={h.id}>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="who">{h.sport} {duration(h.minutes)} <span className="ok">{h.damage}</span></div>
                    <div className="facts">
                      {formatDay(h.trained_on)}
                      {h.bonus_pct ? ` · bonus +${h.bonus_pct} %` : ''}
                      {h.companions.length ? ` · mukana ${h.companions.map((id) => names.get(id)).filter(Boolean).join(', ')}` : ''}
                    </div>
                  </div>
                  <DeleteHitButton id={h.id} />
                </li>
              ))}
            </ul>
          ) : <p className="muted" style={{ margin: 0 }}>Ei vielä iskuja tällä viikolla.</p>}
          <Link className="btn" href="/kirjaa">⚔️ Kirjaa treeni</Link>
        </section>
      ) : null}

      <section className="card">
        <h2 className="display">Ilmoitukset</h2>
        <PushToggle />
      </section>

      {!inSeason ? <Link className="btn btn-ghost" href="/ilmoittaudu">Muokkaa ilmoittautumista</Link> : null}
      {me.is_admin ? <Link className="btn btn-ghost" href="/yllapito">Ylläpito</Link> : null}
    </>
  );
}
