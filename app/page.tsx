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
import Nav from '@/components/Nav';
import TodayCard from '@/components/TodayCard';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { esikatselu?: string; isku?: string; krit?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const inSeason = (week >= 1 && week <= 11) || (me.is_admin && searchParams.esikatselu === '1');
  const battle = maybeBattle ?? (inSeason ? await loadBattle(supabase, today()) : null);
  // Paljastusilmoitus tarkistetaan vain viikon kahtena ensimmäisenä päivänä, ei jokaisella latauksella.
  if (battle && battle.today <= addDays(weekRange(battle.week).start, 1)) await announceReveal(supabase, battle).catch(() => {});

  // Kauden jälkeen: lopputulos ja linkit, ei enää lyöntinappia
  if (battle && week === 12) {
    const kills = battle.ledger?.killed ?? [];
    const bossDown = kills.some((k) => k.week === 11);
    return (
      <>
        <Nav current="/" />
        <BossShadow>
          <span className="pill" style={{ background: 'var(--blood)', alignSelf: 'flex-start' }}>Kausi päättyi 20.12.</span>
          <h2 className="display" style={{ fontSize: 30, color: 'var(--light)' }}>{bossDown ? 'Loppupomo kaatui!' : 'Loppupomo selvisi'}</h2>
          <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>
            Kaadoitte {kills.filter((k) => k.week <= 10).length}/10 viikon monsteria{bossDown ? ' ja loppupomon' : ''}. Kiitos taistelusta, sankarit.
          </p>
        </BossShadow>
        <Link className="btn" href="/raportti/11">Viimeisen viikon raportti</Link>
        <Link className="btn btn-ghost" href="/bestiaario">Bestiaario</Link>
        <Link className="btn btn-ghost" href="/sankarit">Sankarit</Link>
      </>
    );
  }

  if (battle) {
    return (
      <>
        <Nav current="/" />
        <Battle data={battle} userId={user.id} ownHit={Number(searchParams.isku) > 0 ? Number(searchParams.isku) : null} crit={searchParams.krit === '1'} offsetMs={testOffsetMs()} isAdmin={Boolean(me.is_admin)} />
        <TodayCard b={battle} />
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
        <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>Kausi alkaa torstaina 1.10. Ensimmäinen vastus on Willa Rykman. Loppupomo herää 14.12.</p>
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
        <p className="muted" style={{ margin: 0 }}>Monsterien HP lasketaan kaikkien lupauksista, kun ilmoittautuminen sulkeutuu ke 30.9.</p>
      </section>

      <section className="card">
        <h2 className="display">Ilmoitukset</h2>
        <PushToggle />
      </section>

      <Link className="btn btn-ghost" href="/ilmoittaudu">Muokkaa ilmoittautumista</Link>
      {me.is_admin ? <Link className="btn btn-ghost" href="/yllapito">Ylläpito</Link> : null}
    </>
  );
}
