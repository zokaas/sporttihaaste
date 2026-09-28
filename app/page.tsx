import { redirect } from 'next/navigation';
import PushToggle from '@/components/PushToggle';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl, monsterImageUrl } from '@/lib/supabase/client';
import SeasonFinale from '@/components/SeasonFinale';
import { seasonFinale } from '@/lib/finale';
import BossShadow from '@/components/BossShadow';
import Battle from '@/components/Battle';
import { loadBattle } from '@/lib/battle';
import { addDays, seasonWeek, weekRange, AFTER_SEASON, BOSS_WEEK, MONSTER_WEEKS } from '@/lib/season';
import { today, testOffsetMs } from '@/lib/today';
import { currentUser } from '@/lib/auth';
import { STEP_DAY_DAMAGE } from '@/lib/rules';
import { announceReveal } from '@/lib/events';
import Nav from '@/components/Nav';
import Hint from '@/components/Hint';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { esikatselu?: string; isku?: string; krit?: string; askel?: string; finaali?: string } }) {
  const supabase = createClient();
  const user = await currentUser();
  if (!user) redirect('/kirjaudu');

  const week = seasonWeek(today());
  const [{ data: me }, { data: heroes }, maybeBattle] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('profiles').select('id, hero_name, avatar_path, pledge_locked_at').order('created_at'),
    // Kauden aikana taistelu haetaan samaan aikaan profiilin kanssa.
    week >= 1 ? loadBattle(supabase, today()) : Promise.resolve(null),
  ]);
  if (!me?.hero_name || !me?.pledge_locked_at) redirect('/ilmoittaudu');
  const locked = (heroes ?? []).filter((h) => h.pledge_locked_at);
  const img = avatarUrl(me.avatar_path);
  // Ylläpitäjä voi katsoa taistelunäkymää ennen kauden alkua osoitteella /?esikatselu=1.
  const inSeason = (week >= 1 && week <= BOSS_WEEK) || (me.is_admin && searchParams.esikatselu === '1');
  const battle = maybeBattle ?? (inSeason ? await loadBattle(supabase, today()) : null);
  // Paljastusilmoitus tarkistetaan vain viikon kahtena ensimmäisenä päivänä, ei jokaisella latauksella.
  if (battle && battle.today <= addDays(weekRange(battle.week).start, 1)) await announceReveal(supabase, battle).catch(() => { });

  // Kauden jälkeen: loppugaala. Ylläpitäjä voi esikatsella sitä osoitteella /?finaali=1.
  const finale = week === AFTER_SEASON || (me.is_admin && searchParams.finaali === '1');
  const finaleBattle = finale ? battle ?? (await loadBattle(supabase, today())) : null;
  if (finaleBattle) {
    return (
      <>
        <Nav current="/" />
        <SeasonFinale f={seasonFinale(finaleBattle, user.id, avatarUrl, monsterImageUrl)} />
        <Link className="btn btn-ghost" href={`/raportti/${BOSS_WEEK}`}>Viimeisen viikon raportti</Link>
      </>
    );
  }

  if (battle) {
    return (
      <>
        <Nav current="/" />
        <Battle data={battle} userId={user.id} ownHit={Number(searchParams.isku) > 0 ? Number(searchParams.isku) : searchParams.askel ? STEP_DAY_DAMAGE : null} ownStep={Boolean(searchParams.askel) && !(Number(searchParams.isku) > 0)} crit={searchParams.krit === '1'} offsetMs={testOffsetMs()} isAdmin={Boolean(me.is_admin)} />
      </>
    );
  }

  // Ennen kautta: varjo, ilmoittautuneet ja ilmoitukset
  return (
    <>
      <Nav current="/" />
      <div className="row" style={{ alignItems: 'center' }}>
        {img ? <img className="avatar" src={img} alt="" width={56} height={56} /> : null}
        <div className="grow">
          <h1 className="display" style={{ fontSize: 28, overflowWrap: 'anywhere' }}>{me.hero_name}</h1>
          <p className="muted" style={{ margin: 0 }}>Lupaus {String(me.pledge_hours).replace('.', ',')} h viikossa</p>
        </div>
      </div>
      <BossShadow>
        <h2 className="display" style={{ fontSize: 30, color: 'var(--light)' }}>Se odottaa</h2>
        <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>Kausi alkaa torstaina 1.10. Ensimmäinen vastus paljastuu silloin. Loppupomo herää 14.12., ja se on vahvempi kuin yksikään kauden monstereista.</p>
      </BossShadow>

      <section className="card">
        <h2 className="display">Sankarit {locked.length}/10</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: 12 }}>
          {(heroes ?? []).map((h) => {
            const src = avatarUrl(h.avatar_path);
            return (
              <Link key={h.id} href={h.pledge_locked_at ? `/sankari/${h.id}` : '#'} className="rowlink" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: h.pledge_locked_at ? 1 : 0.45 }}>
                {src ? <img className="avatar" src={src} alt="" width={48} height={48} /> : <div className="avatar" style={{ width: 48, height: 48 }}>?</div>}
                <span className="small" style={{ textAlign: 'center', overflowWrap: 'anywhere', lineHeight: 1.25 }}>{h.hero_name ?? 'Kesken'}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <PushToggle card />

      <Link className="btn btn-ghost" href="/ilmoittaudu">Muokkaa ilmoittautumista</Link>
      {me.is_admin ? <Link className="btn btn-ghost" href="/yllapito">Ylläpito</Link> : null}
    </>
  );
}
