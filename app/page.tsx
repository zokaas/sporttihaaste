import { redirect } from 'next/navigation';
import PushToggle from '@/components/PushToggle';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { avatarUrl } from '@/lib/supabase/client';
import BossShadow from '@/components/BossShadow';
import Battle from '@/components/Battle';
import { loadBattle } from '@/lib/battle';
import { addDays, seasonWeek, weekRange } from '@/lib/season';
import { today, testOffsetMs } from '@/lib/today';
import { announceReveal } from '@/lib/events';
import MyWeek from '@/components/MyWeek';
import Nav from '@/components/Nav';
import TodayCard from '@/components/TodayCard';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { esikatselu?: string; isku?: string; krit?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/kirjaudu');

  const { data: me } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!me?.hero_name || !me?.pledge_locked_at) redirect('/ilmoittaudu');

  const { data: heroes } = await supabase.from('profiles').select('id, hero_name, avatar_path, pledge_locked_at').order('created_at');
  const locked = (heroes ?? []).filter((h) => h.pledge_locked_at);
  const img = avatarUrl(me.avatar_path);
  const week = seasonWeek(today());
  // Ylläpitäjä voi katsoa taistelunäkymää ennen kauden alkua osoitteella /?esikatselu=1.
  const inSeason = (week >= 1 && week <= 11) || (me.is_admin && searchParams.esikatselu === '1');
  const battle = inSeason ? await loadBattle(supabase, today()) : null;
  if (battle) await announceReveal(supabase, battle).catch(() => {});

  return (
    <>
      <Nav current="/" />
      {battle ? <Battle data={battle} userId={user.id} ownHit={Number(searchParams.isku) > 0 ? Number(searchParams.isku) : null} crit={searchParams.krit === '1'} offsetMs={testOffsetMs()} /> : null}
      <div className="row" style={{ alignItems: 'center' }}>
        {img ? <Link href={`/sankari/${user.id}`}><img className="avatar" src={img} alt="Oma profiili" width={56} height={56} /></Link> : null}
        <div className="grow">
          <h1 className="display" style={{ fontSize: 28, overflowWrap: 'anywhere' }}>{me.hero_name}</h1>
          <p className="muted" style={{ margin: 0 }}>Lupaus {String(me.pledge_hours).replace('.', ',')} h viikossa</p>
        </div>
      </div>

      {battle ? <TodayCard b={battle} /> : null}
      {battle ? <MyWeek {...myWeekProps(battle, user.id)} /> : null}
      {battle ? null : (
        <BossShadow>
          <h2 className="display" style={{ fontSize: 30, color: 'var(--light)' }}>Se odottaa</h2>
          <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>Kausi alkaa torstaina 1.10. Ensimmäinen vastus on Willa Rykman. Loppupomo herää 14.12.</p>
        </BossShadow>
      )}

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
        {battle ? null : <p className="muted" style={{ margin: 0 }}>Monsterien HP lasketaan kaikkien lupauksista, kun ilmoittautuminen sulkeutuu ke 30.9.</p>}
      </section>

      <section className="card">
        <h2 className="display">Ilmoitukset</h2>
        <PushToggle />
      </section>

      {battle ? null : <Link className="btn btn-ghost" href="/ilmoittaudu">Muokkaa ilmoittautumista</Link>}
      {me.is_admin ? <Link className="btn btn-ghost" href="/yllapito">Ylläpito</Link> : null}
    </>
  );
}

function myWeekProps(b: NonNullable<Awaited<ReturnType<typeof loadBattle>>>, userId: string) {
  const { start, end } = weekRange(b.week);
  const days: { day: string; stepped: boolean; future: boolean; patrol: boolean }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    days.push({
      day: d,
      stepped: b.steps.some((s) => s.user_id === userId && s.day === d),
      future: d > b.today,
      patrol: b.patrols.some((p) => p.day === d),
    });
  }
  const status = b.pledgeStatus(userId, b.week);
  const myHits = b.hits.filter((h) => h.user_id === userId && seasonWeek(h.trained_on) === b.week);
  const stepDamage = days.filter((d) => d.stepped).length * 50;
  const next = b.changes.find((c) => c.user_id === userId && c.from_week === b.week + 1);
  return {
    week: b.week,
    days,
    target: status.target,
    hours: status.hours,
    sickDays: status.sickDays,
    sick: b.sickNow.includes(userId),
    weekDamage: myHits.reduce((a, h) => a + h.damage, 0) + stepDamage,
    stepDamage,
    togetherCount: b.hits.filter((h) => seasonWeek(h.trained_on) === b.week && h.companions.length >= 2 && (h.user_id === userId || h.companions.includes(userId))).length,
    pledge: b.pledgeOf(userId, b.week),
    nextPledge: next ? Number(next.hours) : null,
    canChangePledge: b.week < 11 && seasonWeek(b.today) >= 1,
  };
}
