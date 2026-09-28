import Link from 'next/link';
import { avatarUrl, monsterImageUrl } from '@/lib/supabase/client';
import type { loadBattle } from '@/lib/battle';
import { formatDay, weekRange } from '@/lib/season';
import BossShadow from '@/components/BossShadow';
import MonsterStage from '@/components/MonsterStage';
import KillNotice from '@/components/KillNotice';

type BattleData = Awaited<ReturnType<typeof loadBattle>>;

const fmt = (n: number) => n.toLocaleString('fi-FI');

export default function Battle({ data, ownHit = null }: { data: BattleData; ownHit?: number | null }) {
  const { week, ledger, monsters, heroes, participants, required, sickNow } = data;
  const { end } = weekRange(week);

  if (!ledger) {
    return (
      <BossShadow>
        <h2 className="display" style={{ fontSize: 30, color: 'var(--light)' }}>Se odottaa</h2>
        <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>Monsterien HP:ta ei ole vielä lukittu. Ylläpitäjä lukitsee tavoitteen, ja taistelu alkaa.</p>
      </BossShadow>
    );
  }

  const target = ledger.alive[0];
  const backlog = ledger.alive.slice(1);
  const heroById = new Map(heroes.map((h) => [h.id, h]));

  const killedNames = ledger.killed.map((k) => monsters.get(k.week)?.name ?? `Viikon ${k.week} monsteri`);

  return (
    <>
      <KillNotice killed={ledger.killed.length} names={killedNames} />
      {target ? (
        <MonsterCard data={data} fighter={target} current={week} ownHit={ownHit} />
      ) : (
        <section className="card">
          <h2 className="display">Viikon monsteri on kaatunut!</h2>
          <p style={{ margin: 0 }}>Kaikki tämän viikon iskut menevät pottiin loppupomoa vastaan.</p>
        </section>
      )}

      <Link className="btn" href="/kirjaa">Kirjaa treeni</Link>

      {target ? (
        <section className="card">
          <h2 className="display">Sinetti {required.filter((id) => target.hitters.includes(id)).length}/{required.length}</h2>
          <p className="muted" style={{ margin: 0 }}>Monsteri kaatuu vasta, kun jokainen terve sankari on lyönyt sitä treenillä. Askeleet eivät täytä sinettiä.</p>
          <div className="seal">
            {participants.map((id) => {
              const h = heroById.get(id);
              const src = avatarUrl(h?.avatar_path);
              const hit = target.hitters.includes(id);
              const excused = !required.includes(id);
              const label = `${h?.hero_name ?? ''}${excused ? ' (kipeä)' : ''}`;
              const cls = `avatar${hit ? '' : ' missing'}${excused ? ' sick' : ''}`;
              return (
                <Link key={id} href={`/sankari/${id}`} aria-label={label}>
                  {src ? <img className={cls} src={src} alt={label} title={label} width={32} height={32} /> : <div className={cls} title={label}>{(h?.hero_name ?? '?').slice(0, 1)}</div>}
                </Link>
              );
            })}
          </div>
          {required.some((id) => !target.hitters.includes(id)) ? (
            <p className="small" style={{ margin: 0 }}>
              Puuttuu: {required.filter((id) => !target.hitters.includes(id)).map((id) => heroById.get(id)?.hero_name).join(', ')}
            </p>
          ) : <p className="ok" style={{ margin: 0 }}>Sinetti on täynnä!</p>}
          {sickNow.length ? <p className="muted small" style={{ margin: 0 }}>Kipeänä: {sickNow.map((id) => heroById.get(id)?.hero_name).join(', ')}</p> : null}
        </section>
      ) : null}

      <div className="stat-row">
        <div className="stat"><span className="muted small">Kaatuneet</span><strong>{ledger.killed.filter((k) => k.week <= 10).length}/10</strong></div>
        <div className="stat"><span className="muted small">Potti loppupomolle</span><strong>{fmt(ledger.pot)}</strong><span className="muted small">katto {fmt(ledger.potCap)}</span></div>
      </div>

      {backlog.length ? (
        <section className="card">
          <h2 className="display">Rästit</h2>
          {backlog.map((f) => {
            const m = monsters.get(f.week);
            return <p key={f.week} style={{ margin: 0 }}>{m?.name ?? `Viikon ${f.week} monsteri`}: {f.padded ? `HP 0, ${fmt(f.padded)} padottuna` : `${fmt(f.hp)} HP`}</p>;
          })}
          <p className="muted small" style={{ margin: 0 }}>Vanhin monsteri ottaa iskut ensin.</p>
        </section>
      ) : null}

      <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>Viikko {week} päättyy {formatDay(end)} klo 23.59.</p>
    </>
  );
}

function MonsterCard({ data, fighter, current, ownHit }: { data: BattleData; fighter: NonNullable<BattleData['ledger']>['alive'][number]; current: number; ownHit: number | null }) {
  const m = data.monsters.get(fighter.week);
  const title = m?.name ?? (fighter.week === 11 ? 'Loppupomo' : `Viikon ${fighter.week} monsteri`);
  return (
    <>
      <MonsterStage
        week={fighter.week}
        title={title}
        image={monsterImageUrl(m?.image_path)}
        weakness={m?.weakness ?? null}
        hp={fighter.padded ? 0 : fighter.hp}
        maxHp={m?.hp ?? 1}
        padded={fighter.padded}
        backlog={fighter.week < current}
        revealed={Boolean(m?.name)}
        href={`/monsteri/${fighter.week}`}
        ownHit={ownHit}
        effects
      />
      {m?.description ? <p className="narrator">{m.description}</p> : null}
      {fighter.padded ? (
        <p className="note" style={{ margin: 0, borderLeft: '3px solid var(--gold)' }}>
          HP on loppu, mutta {fmt(fighter.padded)} vahinkoa on padottuna kilpeen. Täyttäkää sinetti ennen sunnuntaita, tai padottu vahinko menetetään.
        </p>
      ) : null}
    </>
  );
}
