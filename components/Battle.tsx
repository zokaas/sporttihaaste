import Link from 'next/link';
import { avatarUrl, monsterImageUrl } from '@/lib/supabase/client';
import type { loadBattle } from '@/lib/battle';
import { formatDay, weekRange } from '@/lib/season';
import BossShadow from '@/components/BossShadow';

type BattleData = Awaited<ReturnType<typeof loadBattle>>;

const fmt = (n: number) => n.toLocaleString('fi-FI');

export default function Battle({ data }: { data: BattleData }) {
  const { week, ledger, monsters, heroes, participants } = data;
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

  return (
    <>
      {target ? <MonsterCard data={data} fighter={target} current={week} /> : (
        <section className="card">
          <h2 className="display">Viikon monsteri on kaatunut!</h2>
          <p style={{ margin: 0 }}>Kaikki tämän viikon iskut menevät pottiin loppupomoa vastaan.</p>
        </section>
      )}

      <Link className="btn" href="/kirjaa">Kirjaa treeni</Link>

      {target ? (
        <section className="card">
          <h2 className="display">Sinetti {target.hitters.length}/{participants.length}</h2>
          <p className="muted" style={{ margin: 0 }}>Monsteri kaatuu vasta, kun jokainen sankari on lyönyt sitä vähintään kerran.</p>
          <div className="seal">
            {participants.map((id) => {
              const h = heroById.get(id);
              const src = avatarUrl(h?.avatar_path);
              const hit = target.hitters.includes(id);
              return src
                ? <img key={id} className={`avatar${hit ? '' : ' missing'}`} src={src} alt={h?.hero_name ?? ''} title={h?.hero_name ?? ''} width={32} height={32} />
                : <div key={id} className={`avatar${hit ? '' : ' missing'}`} title={h?.hero_name ?? ''}>{(h?.hero_name ?? '?').slice(0, 1)}</div>;
            })}
          </div>
          {target.hitters.length < participants.length ? (
            <p className="small" style={{ margin: 0 }}>
              Puuttuu: {participants.filter((id) => !target.hitters.includes(id)).map((id) => heroById.get(id)?.hero_name).join(', ')}
            </p>
          ) : <p className="ok" style={{ margin: 0 }}>Sinetti on täynnä!</p>}
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

function MonsterCard({ data, fighter, current }: { data: BattleData; fighter: NonNullable<BattleData['ledger']>['alive'][number]; current: number }) {
  const m = data.monsters.get(fighter.week);
  const maxHp = m?.hp ?? 1;
  const hp = fighter.padded ? 0 : fighter.hp;
  const img = monsterImageUrl(m?.image_path);
  const title = m?.name ?? (fighter.week === 11 ? 'Loppupomo' : `Viikon ${fighter.week} monsteri`);

  const info = (
    <>
      {fighter.week < current ? <span className="pill" style={{ background: 'var(--blood)', alignSelf: 'flex-start' }}>Rästi viikolta {fighter.week}</span> : null}
      <h2 className="display" style={{ fontSize: 30, color: 'var(--light)' }}>{title}</h2>
      {m?.weakness ? <span className="pill" style={{ alignSelf: 'flex-start' }}>Heikkous: {m.weakness} +50 %</span> : null}
      <div className="hpbar" role="meter" aria-label="Monsterin HP" aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={hp}>
        <span style={{ width: `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%` }} />
      </div>
      <span className="small" style={{ color: '#c9c1b4' }}>{fmt(hp)} / {fmt(maxHp)} HP</span>
      {fighter.padded ? (
        <span className="small" style={{ color: 'var(--blood-text)', fontWeight: 600 }}>
          HP on loppu, mutta {fmt(fighter.padded)} vahinkoa on padottuna. Täyttäkää sinetti ennen sunnuntaita, tai padottu vahinko menetetään.
        </span>
      ) : null}
    </>
  );

  return (
    <>
      {img ? (
        <section className="boss" aria-label={title}>
          <img src={img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div className="shade">{info}</div>
        </section>
      ) : (
        <BossShadow>{info}</BossShadow>
      )}
      {m?.description ? <p style={{ margin: 0 }}>{m.description}</p> : null}
    </>
  );
}
