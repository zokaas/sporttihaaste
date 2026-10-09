'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Finale } from '@/lib/finale';
import ShareRecap from '@/components/ShareRecap';
import { localKey } from '@/lib/localKey';

const fmt = (n: number) => n.toLocaleString('fi-FI');

function read(key: string) {
  try { return localStorage.getItem(localKey(key)); } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(localKey(key), value); } catch { /* ei tallennusta */ }
}

/** Kauden loppugaala: kunniamerkit paljastetaan yksi kerrallaan napauttamalla. */
export default function SeasonFinale({ f }: { f: Finale }) {
  const [shown, setShown] = useState(0);
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    setShown(Math.min(f.awards.length, Number(read('mj_gala') ?? 0)));
    if (!read('mj_finale_seen') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIntro(true);
      const t = window.setTimeout(() => setIntro(false), 3400);
      write('mj_finale_seen', '1');
      return () => clearTimeout(t);
    }
  }, [f.awards.length]);

  const reveal = (n: number) => {
    setShown(n);
    write('mj_gala', String(n));
    if (n > shown && 'vibrate' in navigator) navigator.vibrate(60);
  };
  const allShown = shown >= f.awards.length;

  return (
    <>
      <section className={`stage finale-banner${f.bossDown ? ' state-dead' : ''} is-boss`} aria-label="Kauden lopputulos">
        <div className="stage-art" aria-hidden="true">
          <div className="stage-sky" />
          {f.boss.image ? (
            <>
              <img className="stage-backdrop" src={f.boss.image} alt="" />
              <img className="stage-img" src={f.boss.image} alt="" />
            </>
          ) : null}
          <div className="stage-vignette" />
        </div>
        <div className="stage-top"><span className="stage-week">Kausi päättyi 20.12.</span></div>
        <div className="stage-info">
          <h2 className="display stage-title">{f.bossDown ? `${f.boss.name} kaatui!` : `${f.boss.name} selvisi`}</h2>
          <span className="pill">{f.bossDown ? '💀 Loppupomo voitettu' : '😈 Ensi kerralla'} · {f.regularKilled}/{f.regularTotal} monsteria</span>
        </div>
        {intro ? (
          <div className="stage-reveal" aria-hidden="true">
            <span>Kausi 2026</span>
            <strong className="display">{f.bossDown ? 'Voitto!' : 'Taistelu päättyi'}</strong>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2 className="display">Pokaalikaappi</h2>
        <div className="trophies">
          {f.monsters.map((m) => (
            <Link key={m.week} href={`/monsteri/${m.week}`} className={`trophy${m.killed ? ' killed' : ' survived'}`} title={m.name}>
              {m.image ? <img src={m.image} alt="" /> : <b>{m.week}</b>}
              <span>{m.killed ? '✝' : '😈'}</span>
            </Link>
          ))}
        </div>
        <p className="muted small" style={{ margin: 0 }}>Harmaat kaatuivat, punaiset selvisivät. Napauta monsteria nähdäksesi sen tarinan.</p>
      </section>

      <section className="card">
        <h2 className="display">Kauden luvut</h2>
        <div className="finale-numbers">
          {f.numbers.map((n) => (
            <div key={n.label} className="stat">
              <span className="muted small">{n.label}</span>
              <strong>{n.value}</strong>
              {n.note ? <span className="muted small">{n.note}</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="display">Gaala</h2>
          {!allShown ? <button type="button" className="linklike small" onClick={() => reveal(f.awards.length)}>Näytä kaikki</button> : null}
        </div>
        <ul className="awards">
          {f.awards.map((a, i) => {
            const open = i < shown;
            return (
              <li key={a.title} className={`award${open ? ' open' : ''}`}>
                <span className="award-icon" aria-hidden="true">{a.icon}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="who">{a.title}</div>
                  <div className="facts">{a.detail}</div>
                  {open ? (
                    <div className="award-winners">
                      {a.winners.map((w) => (
                        <Link key={w.id} href={`/sankari/${w.id}`} className="row rowlink" style={{ alignItems: 'center', gap: 8 }}>
                          {w.avatar ? <img className="avatar" src={w.avatar} alt="" width={32} height={32} /> : <div className="avatar" style={{ width: 32, height: 32 }}>{w.name.slice(0, 1)}</div>}
                          <strong>{w.name}</strong>
                        </Link>
                      ))}
                      <span className="muted small">{fmt(a.value)} {a.unit}</span>
                    </div>
                  ) : <div className="award-hidden" aria-label="Paljastamatta">???</div>}
                </div>
              </li>
            );
          })}
        </ul>
        {!allShown ? <button type="button" className="btn btn-strike" onClick={() => reveal(shown + 1)}>🎖️ Paljasta {shown === 0 ? 'ensimmäinen' : 'seuraava'} palkinto</button> : null}
      </section>

      {f.own ? (
        <section className="card">
          <h2 className="display">Sinun kautesi</h2>
          <div className="finale-numbers">
            <div className="stat"><span className="muted small">Voima</span><strong>{fmt(f.own.damage)}</strong><span className="muted small">sija {f.own.rank}/{f.own.of}</span></div>
            <div className="stat"><span className="muted small">Treenitunnit</span><strong>{fmt(Math.round(f.own.hours))}</strong></div>
            <div className="stat"><span className="muted small">Lupaukset</span><strong>{f.own.kept}/{f.own.closed}</strong></div>
            <div className="stat"><span className="muted small">Askelpäivät</span><strong>{f.own.stepDays}</strong></div>
          </div>
          {f.own.bestHit ? <p style={{ margin: 0 }}>Paras iskusi: {f.own.bestHit.sport} {f.own.bestHit.minutes} min, <strong>{fmt(f.own.bestHit.damage)}</strong> voimaa.</p> : null}
          {allShown && f.own.awards.length ? <p style={{ margin: 0 }}>Palkintosi: <strong>{f.own.awards.join(', ')}</strong></p> : null}
          {f.own.badges.length ? (
            <>
              <p className="muted small" style={{ margin: 0 }}>Merkkisi kaudelta:</p>
              <div className="badges">
                {f.own.badges.map((a, i) => (
                  <div key={i} className="badge"><span className="icon" aria-hidden="true">{a.short ?? a.icon}</span><div><strong>{a.title}</strong><div className="muted small">{a.detail}</div></div></div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {allShown ? (
        <section className="card">
          <h2 className="display">Jaa lopputulos</h2>
          <ShareRecap text={f.shareText} />
        </section>
      ) : null}
    </>
  );
}
