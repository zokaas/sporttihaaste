import Link from 'next/link';
import { redirect } from 'next/navigation';
import { navVisibility } from '@/lib/nav';
import Nav from '@/components/Nav';
import BossShadow from '@/components/BossShadow';
import { bossGrowth, bossStirring } from '@/lib/boss';
import { requireHero } from '@/lib/page';
import { monsterImageUrl } from '@/lib/supabase/client';
import { finalBlows } from '@/lib/stats';
import { formatDay, weekRange, BOSS_WEEK, MONSTER_WEEKS } from '@/lib/season';
import { weaknessesOf } from '@/lib/trio';
import { sealView, STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE } from '@/lib/rules';
import SeasonChart from '@/components/SeasonChart';
import { seasonWeek } from '@/lib/season';

export const dynamic = 'force-dynamic';

const fmt = (n: number) => n.toLocaleString('fi-FI');
const killedDay = (ms: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki' }).format(new Date(ms));

export default async function Bestiaario() {
  const [{ battle: b }, show] = await Promise.all([requireHero(), navVisibility()]);
  if (!show.bestiary) redirect('/');
  const blows = finalBlows(b);
  const name = (id: string) => b.heroes.find((h) => h.id === id)?.hero_name ?? 'Megamarssi';
  const killed = new Map((b.ledger?.killed ?? []).map((k) => [k.week, k.killedAt]));
  const alive = new Map((b.ledger?.alive ?? []).map((f) => [f.week, f]));
  const boss = b.monsters.get(BOSS_WEEK);
  const bossRevealed = b.week >= BOSS_WEEK && boss?.name;

  return (
    <>
      <Nav current="/bestiaario" />
      <h1 className="display">Bestiaario</h1>

      <BossShadow growth={bossRevealed ? 1 : bossGrowth(b.week)}>
        <span className="pill" style={{ background: 'var(--blood)', alignSelf: 'flex-start' }}>Loppupomo · {formatDay(weekRange(BOSS_WEEK).start)}</span>
        <h2 className="display" style={{ fontSize: 30, color: 'var(--light)' }}>{bossRevealed ? boss!.name : '???'}</h2>
        <span className="small" style={{ color: '#c9c1b4' }}>
          {bossRevealed
            ? `${boss?.hp ? `${fmt(boss.hp)} HP. ` : ''}Potti ${fmt(Math.min(b.ledger?.pot ?? 0, b.ledger?.potCap ?? 0))} / ${fmt(b.ledger?.potCap ?? 0)} vähennettiin sen HP:sta. Se kaatuu kuten muutkin: HP nollaan ja sinetti täyteen.`
            : `${bossStirring(b.week)} Olette säästäneet sitä vastaan ${fmt(b.ledger?.pot ?? 0)} voimaa. Kaikki säästetty iskee heti, kun se herää.`}
        </span>
      </BossShadow>

      <section className="card">
        <h2 className="display">Kauden käyrä</h2>
        <SeasonChart
          bossWeek={BOSS_WEEK}
          rows={Array.from({ length: Math.min(b.week, BOSS_WEEK) }, (_, i) => {
            const w = i + 1;
            const voima = b.hits.filter((h) => seasonWeek(h.trained_on) === w).reduce((a, h) => a + h.damage, 0)
              + b.steps.filter((x) => seasonWeek(x.day) === w).length * STEP_DAY_DAMAGE
              + b.patrols.filter((p) => seasonWeek(p.day) === w).length * PATROL_DAY_DAMAGE;
            return { week: w, voima, hp: b.monsters.get(w)?.hp ?? null, current: w === b.week && seasonWeek(b.today) <= BOSS_WEEK };
          })}
        />
        <p className="muted small" style={{ margin: 0 }}>Kun pylväs nousee viivan yli, porukka teki viikossa enemmän voimaa kuin viikon monsterissa on HP:ta.</p>
      </section>

      <section className="card">
        <ul className="people">
          {Array.from({ length: MONSTER_WEEKS }, (_, i) => i + 1).map((w) => {
            const m = b.monsters.get(w);
            const img = monsterImageUrl(m?.image_path);
            const k = killed.get(w);
            const f = alive.get(w);
            const future = w > b.week;
            const { start } = weekRange(w);
            return (
              <li key={w} style={future ? { opacity: 0.5 } : undefined}>
                {img && !future
                  ? <img className="avatar" src={img} alt="" width={56} height={56} style={k ? { filter: 'grayscale(1)' } : undefined} />
                  : <div className="avatar" style={{ width: 56, height: 56, fontSize: 22 }}>{future ? '?' : k ? '✝' : '!'}</div>}
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{future ? '???' : <Link className="tap" href={`/monsteri/${w}`}>{m?.name ?? `Viikon ${w} monsteri`}</Link>}</div>
                  <div className="facts">
                    Viikko {w} · {formatDay(start)}
                    {m?.parts?.length && !future ? ' · kolmikko' : ''}
                    {weaknessesOf(m).length && !future ? ` · heikkous ${weaknessesOf(m).join(', ')}` : ''}
                  </div>
                  <div className="facts">
                    {k ? <span className="ok">Kaatui {formatDay(killedDay(k))}{blows[w] ? `, viimeinen isku: ${name(blows[w])}` : ''}</span>
                      : f ? <span style={{ color: 'var(--blood-text)' }}>{w < b.week ? 'Rästissä' : 'Taistelussa'}: {(() => { const v = sealView(f, b.required); return v.dam ? `${fmt(v.hp)} HP, sinetti kesken` : `${fmt(v.hp)} / ${fmt(m?.hp ?? 0)} HP`; })()}</span>
                        : future ? 'Paljastuu viikon alkaessa' : ''}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
