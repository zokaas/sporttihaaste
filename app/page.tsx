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
import { helsinkiMs, seasonWeek, AFTER_SEASON, BOSS_WEEK, GATE_DAY, SEASON_START } from '@/lib/season';
import GateBattle from '@/components/GateBattle';
import Countdown from '@/components/Countdown';
import { today, testOffsetMs } from '@/lib/today';
import { currentUser } from '@/lib/auth';
import { navVisibility } from '@/lib/nav';
import Nav from '@/components/Nav';
import Hint from '@/components/Hint';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { esikatselu?: string; isku?: string; krit?: string; finaali?: string } }) {
  const supabase = createClient();
  navVisibility().catch(() => {});
  const user = await currentUser();
  if (!user) redirect('/kirjaudu');

  const week = seasonWeek(today());
  // Portinvartijan päivä (ke 30.9.): yhden päivän taistelu ennen kauden alkua.
  const gateDay = today() === GATE_DAY;
  const [{ data: me }, { data: heroes }, maybeBattle, { data: firstMonster }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('profiles').select('id, hero_name, avatar_path, pledge_locked_at').order('created_at'),
    // Kauden aikana taistelu haetaan samaan aikaan profiilin kanssa.
    week >= 1 || gateDay ? loadBattle(supabase, today()) : Promise.resolve(null),
    // Ennen kautta: ensimmäisen monsterin arvoitus (näkymä paljastaa sen 3 pv ennen paljastusta).
    week < 1 ? supabase.from('monsters_public').select('teaser').eq('week', 1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!me?.hero_name || !me?.pledge_locked_at) redirect('/ilmoittaudu');
  const locked = (heroes ?? []).filter((h) => h.pledge_locked_at);
  const img = avatarUrl(me.avatar_path);
  // Ylläpitäjä voi katsoa taistelunäkymää ennen kauden alkua osoitteella /?esikatselu=1.
  const inSeason = (week >= 1 && week <= BOSS_WEEK) || (me.is_admin && searchParams.esikatselu === '1');
  const gateBattle = gateDay ? maybeBattle : null;
  const battle = (week >= 1 ? maybeBattle : null) ?? (inSeason ? await loadBattle(supabase, today()) : null);
  // Paljastusilmoitus tarkistetaan vain viikon kahtena ensimmäisenä päivänä, ei jokaisella latauksella.

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
        <Battle data={battle} userId={user.id} ownHit={Number(searchParams.isku) > 0 ? Number(searchParams.isku) : null} crit={searchParams.krit === '1'} offsetMs={testOffsetMs()} isAdmin={Boolean(me.is_admin)} />
      </>
    );
  }

  // Ennen kautta: varjo, ilmoittautuneet ja ilmoitukset
  return (
    <>
      <Nav current="/" />
      {gateBattle ? (
        <GateBattle
          gate={gateBattle.gate}
          hits={gateBattle.hits.filter((h) => h.trained_on === GATE_DAY)}
          names={new Map(gateBattle.heroes.map((h) => [h.id, h.hero_name ?? '']))}
          stepped={gateBattle.steps.filter((x) => x.day === GATE_DAY).length}
          ownHit={Number(searchParams.isku) > 0 ? Number(searchParams.isku) : null}
          crit={searchParams.krit === '1'}
          offsetMs={testOffsetMs()}
        />
      ) : null}
      <div className="row" style={{ alignItems: 'center' }}>
        {img ? <img className="avatar" src={img} alt="" width={56} height={56} /> : null}
        <div className="grow">
          <h1 className="display" style={{ fontSize: 28, overflowWrap: 'anywhere' }}>{me.hero_name}</h1>
          <p className="muted" style={{ margin: 0 }}>Lupaus {String(me.pledge_hours).replace('.', ',')} h viikossa</p>
        </div>
      </div>
      <section className="card teaser prelude" aria-label="Ensimmäinen vastus">
        <svg className="teaser-shadow" viewBox="0 0 390 300" aria-hidden="true">
          <path d="M70 300 C80 215 125 170 158 156 C140 120 126 76 104 30 C146 60 166 100 176 138 C186 134 204 134 214 138 C224 100 244 60 286 30 C264 76 250 120 232 156 C265 170 310 215 320 300 Z" fill="#050303" />
          <g className="prelude-eyes">
            <ellipse cx="180" cy="176" rx="9" ry="3.5" fill="#ff4a2e" />
            <ellipse cx="210" cy="176" rx="9" ry="3.5" fill="#ff4a2e" />
          </g>
        </svg>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="stage-week">Ensimmäinen vastus · to 1.10. klo 00.00</span>
          <p className="teaser-text">“{(firstMonster as { teaser?: string | null } | null)?.teaser || 'Jotain liikkuu varjoissa. Se on jo matkalla, ja se tietää nimesi…'}”</p>
          <Countdown endMs={helsinkiMs(SEASON_START, '00:00:00')} offsetMs={testOffsetMs()} title="Aikaa ensimmäisen monsterin paljastumiseen" done="Se on täällä!" suffix="paljastukseen" />
        </div>
      </section>
      <BossShadow>
        <h2 className="display" style={{ fontSize: 30, color: 'var(--light)' }}>Se odottaa</h2>
        <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>Kausi alkaa torstaina 1.10. Joka maanantai sen jälkeen nousee uusi vastus. Loppupomo herää 14.12., ja se on vahvempi kuin yksikään kauden monstereista.</p>
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
