'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Props = {
  week: number;
  title: string;
  image: string | null;
  weakness: string | null;
  hp: number;
  maxHp: number;
  padded: number;
  backlog: boolean;
  revealed: boolean;
  /** Paljastus ja osuma-animaatiot (vain etusivun nykyiselle monsterille). */
  effects?: boolean;
  /** Kaatunut monsteri: harmaa ja liikkumaton. */
  dead?: boolean;
  /** Napautus avaa tämän osoitteen; ilman sitä näyttämö ei ole linkki. */
  href?: string;
  /** Oma juuri kirjattu isku (?isku=…), näytetään lentävänä lukuna. */
  ownHit: number | null;
};

const fmt = (n: number) => n.toLocaleString('fi-FI');

/** Monsterin tila HP:n mukaan: hengittää, haavoittunut (halkeamat), kuoleva (sykkii) tai kilpi (sinetti kesken). */
function stateOf(hp: number, maxHp: number, padded: number, dead: boolean) {
  if (dead) return 'dead';
  if (padded > 0 || hp <= 0) return 'shielded';
  const pct = hp / maxHp;
  if (pct < 0.2) return 'dying';
  if (pct < 0.5) return 'hurt';
  return 'healthy';
}

function read(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ei tallennusta */ }
}

export default function MonsterStage(p: Props) {
  const state = stateOf(p.hp, p.maxHp, p.padded, Boolean(p.dead));
  const [shownHp, setShownHp] = useState(p.hp);
  const [flying, setFlying] = useState<{ n: number; own: boolean } | null>(null);
  const [hit, setHit] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!p.effects) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hpKey = `mj_hp_${p.week}`;
    const last = Number(read(hpKey));
    write(hpKey, String(p.hp));

    // G: uuden monsterin paljastus ensimmäisellä näkemällä
    const seenKey = `mj_seen_${p.week}`;
    const firstSight = p.revealed && !read(seenKey);
    if (p.revealed) write(seenKey, '1');
    if (firstSight && !reduced) {
      setRevealing(true);
      timers.current.push(window.setTimeout(() => setRevealing(false), 3200));
      return;
    }

    // E: HP-palkki laskee edellisestä käynnistä nykyiseen, ja vahinko lentää kuvan päälle
    const drop = last > p.hp ? last - p.hp : 0;
    const damage = p.ownHit ?? drop;
    if (damage > 0 && !reduced) {
      setShownHp(Math.min(p.maxHp, p.hp + damage));
      setFlying({ n: damage, own: p.ownHit != null });
      setHit(true);
      timers.current.push(window.setTimeout(() => setShownHp(p.hp), 450));
      timers.current.push(window.setTimeout(() => setHit(false), 900));
      timers.current.push(window.setTimeout(() => setFlying(null), 1800));
    }
    if (p.ownHit != null) window.history.replaceState(null, '', window.location.pathname);
    return () => timers.current.forEach(clearTimeout);
  }, [p.effects, p.week, p.hp, p.maxHp, p.ownHit, p.revealed]);

  const pct = Math.max(0, Math.min(100, (shownHp / p.maxHp) * 100));
  const label = `${p.title}, ${fmt(p.hp)} / ${fmt(p.maxHp)} HP.`;
  const className = `stage state-${state}${hit ? ' is-hit' : ''}${revealing ? ' is-revealing' : ''}`;

  const content = (
    <>
      <div className="stage-art" aria-hidden="true">
        {p.image ? (
          <>
            <img className="stage-backdrop" src={p.image} alt="" />
            <img className="stage-img" src={p.image} alt="" />
          </>
        ) : (
          <svg className="stage-img stage-shadow" viewBox="0 0 390 300" preserveAspectRatio="xMidYMax meet">
            <path d="M70 300 C80 215 125 170 158 156 C140 120 126 76 104 30 C146 60 166 100 176 138 C186 134 204 134 214 138 C224 100 244 60 286 30 C264 76 250 120 232 156 C265 170 310 215 320 300 Z" fill="#050303" style={{ filter: 'blur(6px)' }} />
            <ellipse cx="180" cy="176" rx="9" ry="3.5" fill="#ff4a2e" />
            <ellipse cx="210" cy="176" rx="9" ry="3.5" fill="#ff4a2e" />
          </svg>
        )}
        {state === 'hurt' || state === 'dying' ? (
          <svg className="stage-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M8 0 L14 18 L9 27 L17 41 M14 18 L24 22 M92 100 L85 80 L90 70 L81 57 M85 80 L74 83 M60 0 L57 12 L63 20 L58 31" />
            {state === 'dying' ? <path d="M0 62 L12 60 L18 67 L30 64 M100 30 L88 34 L84 28 L72 33 L66 44" /> : null}
          </svg>
        ) : null}
        <div className="stage-vignette" />
        {state === 'shielded' ? <div className="stage-shield" /> : null}
      </div>

      {flying ? <div className={`stage-damage${flying.own ? ' own' : ''}`} aria-live="polite">−{fmt(flying.n)}{flying.own ? <small>Osumasi!</small> : null}</div> : null}

      <div className="stage-info">
        {p.backlog ? <span className="pill" style={{ background: 'var(--blood)' }}>Rästi viikolta {p.week}</span> : null}
        <h2 className="display stage-title">{p.title}</h2>
        {p.weakness ? <span className="pill">Heikkous: {p.weakness} +50 %</span> : null}
        <div className="stage-hp" role="meter" aria-label="Monsterin HP" aria-valuemin={0} aria-valuemax={p.maxHp} aria-valuenow={p.hp}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="stage-hptext">
          <span>{fmt(Math.max(0, p.hp))} / {fmt(p.maxHp)} HP</span>
          <span className="stage-state">{state === 'dead' ? 'Kaatunut' : state === 'shielded' ? 'Sinetti kesken' : state === 'dying' ? 'Horjuu!' : state === 'hurt' ? 'Haavoittunut' : ''}</span>
        </div>
      </div>

      {revealing ? (
        <div className="stage-reveal" aria-hidden="true">
          <span>Viikko {p.week}</span>
          <strong className="display">{p.title}</strong>
        </div>
      ) : null}
    </>
  );

  return p.href
    ? <Link href={p.href} className={className} aria-label={`${label} Avaa monsterin sivu.`}>{content}</Link>
    : <section className={className} aria-label={label}>{content}</section>;
}
