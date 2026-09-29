import Link from 'next/link';
import Nav from '@/components/Nav';
import MyWeek from '@/components/MyWeek';
import PushToggle from '@/components/PushToggle';
import DeleteHitButton from '@/components/DeleteHitButton';
import { requireHero } from '@/lib/page';
import { avatarUrl } from '@/lib/supabase/client';
import { myWeekProps } from '@/lib/myweek';
import { formatDay, isGateDay, seasonWeek, BOSS_WEEK } from '@/lib/season';

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
      <Link href={`/sankari/${user.id}`} className="rowlink row profile-line">
        {img ? <img className="avatar" src={img} alt="" width={36} height={36} /> : <div className="avatar" style={{ width: 36, height: 36 }}>{(me.hero_name ?? '?').slice(0, 1)}</div>}
        <strong className="grow" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{me.hero_name}</strong>
        <span className="muted small">Profiili →</span>
      </Link>

      {inSeason ? <MyWeek {...myWeekProps(b, user.id)} /> : (
        <section className="card">
          <h2 className="display">Minun viikkoni</h2>
          <p style={{ margin: 0 }}>{isGateDay(b.today) ? 'Portti aukesi etuajassa: Sauronin silmä on kaadettava ke klo 23.59 mennessä. Kirjaa treenit ja askeleet Lyö-napista. Viikkodata alkaa to 1.10.' : 'Kausi alkaa to 1.10. Silloin täällä näkyy enemmän dataa.'}</p>
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

      <PushToggle card />

      {!inSeason ? <Link className="btn btn-ghost" href="/ilmoittaudu">Muokkaa ilmoittautumista</Link> : null}
      {me.is_admin ? <Link className="btn btn-ghost" href="/yllapito">Ylläpito</Link> : null}
    </>
  );
}
