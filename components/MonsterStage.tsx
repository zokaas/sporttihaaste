'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Countdown from '@/components/Countdown';
import { groupName } from '@/lib/trio';
import { resizedImage } from '@/lib/supabase/client';
import { Viewer } from '@/components/ImageViewer';
import { localKey } from '@/lib/localKey';
import type { Line } from '@/lib/taunts';

/** Puhekuplan sisältö: puhujan nimi (moniosaisella) ja repliikki. */
function Speech({ line }: { line: Line }) {
  return <>{line.who ? <b className="stage-taunt-who">{line.who}</b> : null}“{line.text}”</>;
}

export type StagePart = { name: string; image: string | null; hp: number; left: number; dead: boolean };

export type SealHero = { id: string; initial: string; avatar: string | null; hit: boolean; excused: boolean; name: string };

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
  /** Napautus avaa tämän osoitteen; ilman sitä näyttämö ei ole linkki. */
  href?: string;
  /** Ilman linkkiä: napautus avaa nämä kuvat koko ruudulle. */
  zoom?: string[];
  /** Oma juuri kirjattu isku (?isku=…), näytetään lentävänä lukuna. */
  ownHit: number | null;
  /** Oman iskun otsikko (oletus "Osumasi!", esim. askelkuittauksella "👣 Askeleet!"). */
  ownLabel?: string;
  /** Oma isku oli kriittinen (bonuksia vähintään +100 %). */
  crit?: boolean;
  /** Paljastus ja osuma-animaatiot (vain etusivun nykyiselle monsterille). */
  effects?: boolean;
  /** Kaatunut monsteri: harmaa ja liikkumaton. */
  dead?: boolean;
  /** Sinettirengas: kuka on lyönyt. */
  seal?: SealHero[];
  /** Viikon loppu (ms) ja testitilan siirtymä. */
  endMs?: number;
  /** Monsterin repliikit (täysi HP / alle 50 % / 20 %) puhekuplina; moniosaisella osa per kupla. */
  taunt?: Line[] | string | null;
  /** Monsterin reaktio omaan juuri kirjattuun iskuun; näkyy hetken tauntin tilalla. */
  hitLine?: Line | string | null;
  /** Kuluva viikko, jos näyttämöllä on rästi (yläpalkin otsikko). */
  currentWeek?: number;
  /** Yläpalkin otsikko viikkonumeron sijaan (esim. portinvartija). */
  label?: string;
  /** Paljastuksen yläotsikko ja alarivi (oletus: viikko / loppupomon teksti). */
  revealLabel?: string;
  revealLine?: string;
  offsetMs?: number;
  /** Loppupomo: punainen taivas; potti iskee paljastuksen yhteydessä. */
  boss?: boolean;
  potStrike?: number;
  /** Monsterikolmikko: osat kaatuvat järjestyksessä, etummainen näytetään isona. */
  parts?: StagePart[] | null;
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
  try { return localStorage.getItem(localKey(key)); } catch { return null; }
}
function write(key: string, value: string) {
  try { localStorage.setItem(localKey(key), value); } catch { /* ei tallennusta */ }
}

const TAUNT_MS = 4000;
/** Osan kaatumisbannerin kesto (sama kuin .part-fall-animaatio). */
const PART_FALL_MS = 2800;

export default function MonsterStage(p: Props) {
  const state = stateOf(p.hp, p.maxHp, p.padded, Boolean(p.dead));
  const [shownHp, setShownHp] = useState(p.hp);
  const [flying, setFlying] = useState<{ n: number; label: string | null; crit: boolean } | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [hit, setHit] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [partFall, setPartFall] = useState<string | null>(null);
  const [claw, setClaw] = useState(0);
  const [reply, setReply] = useState(false);
  const timers = useRef<number[]>([]);
  const rootRef = useRef<HTMLElement | null>(null);
  const [offscreen, setOffscreen] = useState(false);
  // Puhekupla näkyy 4 s ja häipyy, jotta kuva jää näkyviin. Aika lasketaan vasta, kun kupla oikeasti näkyy:
  // näyttämö ruudulla, välilehti auki, paljastusanimaatio ohi ja isot ruudut suljettu. Jos jokin katkeaa, aika alkaa alusta.
  const [taunt, setTaunt] = useState<'on' | 'fading' | 'gone'>('on');
  const [pageVisible, setPageVisible] = useState(true);
  // Iso ruutu (kaatuminen, viikkoraportti) auki: puhekuplan aika ei kulu sen takana.
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    const w = window as unknown as { __mjModalOpen?: boolean };
    setModalOpen(Boolean(w.__mjModalOpen));
    const open = () => setModalOpen(true);
    const closed = () => setModalOpen(false);
    window.addEventListener('mj:modal-open', open);
    window.addEventListener('mj:modal-closed', closed);
    return () => { window.removeEventListener('mj:modal-open', open); window.removeEventListener('mj:modal-closed', closed); };
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const taunts: Line[] = typeof p.taunt === 'string' ? [{ who: null, text: p.taunt }] : p.taunt ?? [];
  const hitLine: Line | null = typeof p.hitLine === 'string' ? { who: null, text: p.hitLine } : p.hitLine ?? null;
  const tauntKey = taunts.map((l) => `${l.who}:${l.text}`).join('|');
  useEffect(() => { setTaunt('on'); }, [tauntKey]);
  useEffect(() => {
    if (taunt === 'gone') return;
    if (taunt === 'fading') {
      const t = window.setTimeout(() => setTaunt('gone'), 600);
      return () => clearTimeout(t);
    }
    if (offscreen || revealing || !pageVisible || modalOpen) return;
    const t = window.setTimeout(() => setTaunt('fading'), TAUNT_MS + Math.max(0, taunts.length - 1) * 2500);
    return () => clearTimeout(t);
  }, [taunt, offscreen, revealing, pageVisible, modalOpen, taunts.length]);
  const parts = p.parts?.length ? p.parts : null;
  const front = parts ? parts.find((x) => !x.dead) ?? parts[parts.length - 1] : null;
  const deadParts = parts ? parts.filter((x) => x.dead).length : 0;

  // Kun näyttämö on vieritetty pois näkyvistä, sen jatkuvat animaatiot pysäytetään: vieritys pysyy sulavana.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Kaksikon tai kolmikon osan kaatuminen: lyhyt banneri, kun kaatuneiden määrä kasvaa edellisestä käynnistä.
  // Banneri odottaa, kunnes isot ruudut (kaatuminen, viikkoraportti) on suljettu, jotta se ei jää niiden alle.
  // Oman iskun reaktiokupla (kaatumisrepliikki) tulee vasta bannerin jälkeen (partFellRef).
  const partFellRef = useRef(false);
  useEffect(() => {
    if (!p.effects || !parts) return;
    const key = `mj_parts_${p.week}`;
    const before = Number(read(key) ?? deadParts);
    write(key, String(deadParts));
    if (deadParts > before && deadParts < parts.length) {
      partFellRef.current = true;
      const name = parts[deadParts - 1].name;
      let t = 0;
      const show = () => { setPartFall(name); t = window.setTimeout(() => setPartFall(null), PART_FALL_MS); };
      if ((window as unknown as { __mjModalOpen?: boolean }).__mjModalOpen) {
        window.addEventListener('mj:modal-closed', show, { once: true });
        return () => { window.removeEventListener('mj:modal-closed', show); clearTimeout(t); };
      }
      show();
      return () => clearTimeout(t);
    }
  }, [p.effects, p.week, deadParts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!p.effects) { setShownHp(p.hp); return; }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
    const strike = (n: number, label: string | null, crit: boolean, from: number) => {
      setShownHp(from);
      setFlying({ n, label, crit });
      setHit(true);
      // Oma isku jättää hetkeksi kynnenjäljen monsteriin.
      if (label) { setClaw(Date.now()); later(() => setClaw(0), 2200); }
      if (label && p.hitLine) {
        // Jos isku kaatoi osan, kupla tulee vasta "kaatui"-bannerin jälkeen.
        const at = partFellRef.current ? PART_FALL_MS + 200 : 500;
        partFellRef.current = false;
        later(() => setReply(true), at);
        later(() => setReply(false), at + 5000);
      }
      later(() => setShownHp(p.hp), 450);
      later(() => setHit(false), 900);
      later(() => setFlying(null), crit ? 2300 : 1800);
    };

    const hpKey = `mj_hp_${p.week}`;
    const last = Number(read(hpKey));
    write(hpKey, String(p.hp));

    // G: uuden monsterin paljastus ensimmäisellä näkemällä (loppupomolla potti iskee perään)
    const seenKey = `mj_seen_${p.week}`;
    const firstSight = p.revealed && !read(seenKey);
    if (p.revealed) write(seenKey, '1');
    if (firstSight && !reduced) {
      setShownHp(p.hp);
      const reveal = () => {
        const dur = p.boss ? 5200 : 3200;
        setRevealing(true);
        if (!p.boss && 'vibrate' in navigator) navigator.vibrate([70, 130, 70, 500]);
        later(() => setRevealing(false), dur);
        if (p.boss && 'vibrate' in navigator) navigator.vibrate([200, 100, 200, 100, 400]);
        if (p.boss && p.potStrike) later(() => strike(p.potStrike!, 'Ensi-isku!', true, p.maxHp), dur + 200);
      };
      if ((window as unknown as { __mjModalOpen?: boolean }).__mjModalOpen) {
        window.addEventListener('mj:modal-closed', reveal, { once: true });
        return () => { window.removeEventListener('mj:modal-closed', reveal); timers.current.forEach(clearTimeout); };
      }
      reveal();
      return () => timers.current.forEach(clearTimeout);
    }

    // E: HP-palkki laskee edellisestä käynnistä nykyiseen, ja vahinko lentää kuvan päälle
    const drop = last > p.hp ? last - p.hp : 0;
    const damage = p.ownHit ?? drop;
    // Ilman animaatiota palkki hyppää suoraan uuteen HP:hen (muuten se jäisi edelliseen arvoon).
    if (damage <= 0 || reduced) setShownHp(p.hp);
    if (damage > 0 && !reduced) {
      strike(damage, p.ownHit != null ? (p.crit ? 'KRIITTINEN!' : p.ownLabel ?? 'Osumasi!') : null, Boolean(p.crit && p.ownHit != null), Math.min(p.maxHp, p.hp + damage));
      if (p.ownHit != null && 'vibrate' in navigator) navigator.vibrate(p.crit ? [80, 40, 80, 40, 160] : [60, 40, 120]);
    }
    if (p.ownHit != null) window.history.replaceState(null, '', window.location.pathname);
    return () => timers.current.forEach(clearTimeout);
  }, [p.effects, p.week, p.hp, p.maxHp, p.ownHit, p.crit, p.revealed, p.boss, p.potStrike]);

  const pct = Math.max(0, Math.min(100, (shownHp / p.maxHp) * 100));
  // Pato näytetään suhteessa kolmannekseen monsterin HP:sta, jotta pienikin pato näkyy.
  const damPct = Math.min(100, (p.padded / Math.max(1, p.maxHp / 3)) * 100);
  const label = `${p.title}, ${fmt(p.hp)} / ${fmt(p.maxHp)} HP.`;
  const nearDeath = state === 'dying' && p.hp / p.maxHp < 0.1;
  const className = `stage state-${state}${offscreen ? ' is-offscreen' : ''}${nearDeath ? ' near-death' : ''}${hit ? ' is-hit' : ''}${revealing ? ' is-revealing' : ''}${p.boss ? ' is-boss' : ''}`;
  const sealDone = p.seal ? p.seal.filter((s) => !s.excused).every((s) => s.hit) : false;

  const image = front ? front.image ?? p.image : p.image;
  // Kaatunut kaksikko tai kolmikko näytetään koko porukkana.
  const groupImages = p.dead && parts ? parts.map((x) => x.image).filter((x): x is string => Boolean(x)) : [];
  const title = front && !p.dead ? front.name : p.title;

  const content = (
    <>
      <div className="stage-art" aria-hidden="true" style={{ ['--dam' as string]: String(damPct / 100) }}>
        {p.boss ? <div className="stage-sky" /> : null}
        {groupImages.length > 1 ? (
          <>
            <img className="stage-backdrop" src={resizedImage(groupImages[0], 96)} alt="" />
            <div className="stage-group">
              {groupImages.map((src) => <img key={src} className="stage-group-img" src={src} alt="" />)}
            </div>
          </>
        ) : image ? (
          <>
            {/* Tausta on sumennettu, joten siihen riittää pieni kuva: kevyempi ladata ja piirtää. */}
            <img className="stage-backdrop" src={resizedImage(image, 96)} alt="" />
            <img className="stage-img" src={image} alt="" />
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
        {claw ? (
          <svg key={claw} className="stage-claw" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M30 18 C40 38 48 58 52 84" />
            <path d="M40 14 C50 36 58 56 63 80" />
            <path d="M50 12 C60 34 68 52 74 74" />
          </svg>
        ) : null}
        {state !== 'dead' ? (
          <div className="stage-embers">
            {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${6 + ((i * 41) % 88)}%`, animationDelay: `${(i * 1.7) % 9}s`, animationDuration: `${8 + (i % 4) * 2}s` }} />)}
          </div>
        ) : null}
        <div className="stage-vignette" />
        {state === 'shielded' ? <div className="stage-shield" /> : null}
      </div>

      {p.endMs ? <div className="stage-top"><span className="stage-week">{p.label ?? (p.boss ? 'Loppupomo' : `Viikko ${p.currentWeek ?? p.week}`)}</span><Countdown endMs={p.endMs} offsetMs={p.offsetMs} /></div> : null}

      {flying ? (
        <div className={`stage-damage${flying.label ? ' own' : ''}${flying.crit ? ' crit' : ''}`} aria-live="polite">
          −{fmt(flying.n)}{flying.label ? <small>{flying.label}</small> : null}
        </div>
      ) : null}

      <div className="stage-info">
        {/* Puhekupla nimen yläpuolella, jotta se ei peitä kuvan kasvoja (ne ovat yleensä kuvan yläosassa). */}
        {reply && hitLine && !p.dead ? <div key="reply" className="stage-taunt is-reply" role="status"><Speech line={hitLine} /></div>
          : taunts.length && !p.dead && taunt !== 'gone' ? taunts.map((l, i) => (
            <div key={`taunt-${i}`} className={`stage-taunt${taunt === 'fading' ? ' fading' : ''}`} role="note" style={i && taunt !== 'fading' ? { animationDelay: `${i * 0.6}s` } : undefined}><Speech line={l} /></div>
          )) : null}
        {p.backlog ? <span className="pill" style={{ background: 'var(--blood)' }}>Rästi viikolta {p.week}</span> : null}
        {parts ? (
          <div className="stage-parts" aria-label={`${groupName(parts.length)}: ${deadParts}/${parts.length} kaatunut`}>
            {parts.map((x) => (
              <span key={x.name} className={`stage-part${x.dead ? ' dead' : ''}${x === front && !p.dead ? ' front' : ''}`} title={`${x.name}${x.dead ? ' – kaatunut' : ''}`}>
                {x.image ? <img src={x.image} alt="" /> : <b>{x.name.slice(0, 1)}</b>}
              </span>
            ))}
            <span className="stage-parts-label">{groupName(parts.length)} {deadParts}/{parts.length}</span>
          </div>
        ) : null}
        <h2 className="display stage-title">{title}</h2>
        {p.weakness ? <span className="pill">Heikkous: {p.weakness} +50 %</span> : null}
        <div className={`stage-hp${parts ? ' segmented' : ''}`} role="meter" aria-label="Monsterin HP" aria-valuemin={0} aria-valuemax={p.maxHp} aria-valuenow={p.hp}>
          <span style={{ width: `${pct}%` }} />
          {parts ? parts.slice(0, -1).reduce<{ at: number; marks: number[] }>((acc, x) => { acc.at += x.hp; acc.marks.push(acc.at); return acc; }, { at: 0, marks: [] }).marks.map((at) => <i key={at} style={{ left: `${100 - (at / p.maxHp) * 100}%` }} />) : null}
        </div>
        <div className="stage-hptext">
          <span>{fmt(Math.max(0, p.hp))} / {fmt(p.maxHp)} HP</span>
          <span className="stage-state">{state === 'dead' ? 'Kaatunut' : state === 'shielded' ? 'Sinetti kesken' : state === 'dying' ? 'Horjuu!' : state === 'hurt' ? 'Haavoittunut' : ''}</span>
        </div>
        {p.seal?.length ? (
          <div className={`stage-seal${sealDone ? ' done' : ''}`} aria-label={`Sinetti: ${p.seal.filter((s) => s.hit).length} / ${p.seal.filter((s) => !s.excused || s.hit).length} lyönyt`}>
            {p.seal.map((s) => (
              <span key={s.id} className={`seal-dot${s.hit ? ' hit' : ''}${s.excused && !s.hit ? ' excused' : ''}`} title={`${s.name}${s.hit ? ' – lyönyt' : s.excused ? ' (kipeä)' : ' – puuttuu'}`}>
                {s.avatar ? <img src={s.avatar} alt="" /> : s.initial}
              </span>
            ))}
          </div>
        ) : null}
        {p.boss ? <span className="small" style={{ color: '#f0c9a8' }}>Viimeinen taistelu. Ensi-isku osui jo, loput on teidän.</span> : null}
      </div>

      {partFall ? (
        <div className="stage-reveal part-fall" aria-live="polite">
          <span>{parts?.length === 2 ? 'Kaksikosta' : 'Kolmikosta'} kaatui</span>
          <strong className="display">{partFall}</strong>
        </div>
      ) : null}

      {revealing ? (
        <div className="stage-reveal" aria-hidden="true">
          <span>{p.revealLabel ?? (p.boss ? 'Loppupomo herää' : `Viikko ${p.week}`)}</span>
          <strong className="display">{p.title}</strong>
          {p.revealLine ? <em>{p.revealLine}</em> : p.boss ? <em>Maa järisee. Taivas punertuu. Se on täällä.</em> : null}
        </div>
      ) : null}
    </>
  );

  return p.href
    ? <Link ref={(el) => { rootRef.current = el; }} href={p.href} className={className} aria-label={`${label} Avaa monsterin sivu.`}>{content}</Link>
    : p.zoom?.length ? (
      <>
        <section ref={(el) => { rootRef.current = el; }} className={`${className} is-zoomable`} aria-label={`${label} Avaa kuva.`} role="button" tabIndex={0}
          onClick={() => setZoomed(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setZoomed(true); } }}>{content}</section>
        {zoomed ? <Viewer images={p.zoom} onClose={() => setZoomed(false)} /> : null}
      </>
    )
    : <section ref={(el) => { rootRef.current = el; }} className={className} aria-label={label}>{content}</section>;
}
