'use client';
import { useEffect, useRef, useState } from 'react';
import { localKey } from '@/lib/localKey';
import { heartbeat, riser, setDread, startSound, stopHeartbeat, stopSound, thud } from '@/lib/storySound';

export type EpisodeHero = { id: string; name: string; avatar: string | null };
export type EpisodeData = {
  episode: number;
  heroes: EpisodeHero[];
  me: string | null;
  gateDay: string;
  fallen: { name: string; image: string | null; blow: string | null }[];
  /** Tämän viikon monsteri (näkyy jo etusivulla); null, jos se on jo kaatunut. */
  current: { name: string; image: string | null } | null;
  week: number;
  overdue: number;
  biggest: { name: string; sport: string; minutes: number; damage: number } | null;
  together: { name: string; people: number; sport: string; damage: number } | null;
  trainings: number;
  stepDays: number;
  patrols: number;
  jointTrainings: number;
  kept: number;
  pledges: number;
  damage: number;
  pot: number;
  daysLeft: number;
};

const INK = '#1a0f0c';
const GOLD = '#e8b04a';
const CAPES = ['#b3261e', '#e8b04a', '#3f7d5c', '#5b4a8a', '#c2562c'];
const SHIRTS = ['#2f4a3f', '#7d1812', '#3b3f6b', '#8a5a12', '#4a2a4a'];
const SKIN = '#e9c3a4';
const fmt = (n: number) => n.toLocaleString('fi-FI');
const SOUND = 'mj_story_sound';

type Pose = 'down' | 'up' | 'wave' | 'run' | 'sad';

/** Piirretty sankari, jonka kasvoina on sankarin oma avatar (tai alkukirjain). */
function Hero({ h, k, x, y, s = 1, pose = 'down', cape, cls = '', delay = 0, label = false, sword = false }: { h: EpisodeHero; k: string; x: number; y: number; s?: number; pose?: Pose; cape?: string; cls?: string; delay?: number; label?: boolean; sword?: boolean }) {
  const shirt = SHIRTS[h.name.length % SHIRTS.length];
  const arm = (side: number) => {
    const end = pose === 'up' ? [side * 34, -200] : pose === 'wave' ? (side > 0 ? [40, -190] : [-30, -70]) : pose === 'run' ? [side * 30, side > 0 ? -140 : -80] : pose === 'sad' ? [side * 14, -72] : [side * 28, -66];
    return (
      <g className={pose === 'wave' && side > 0 ? 'ep-wave' : undefined}>
        <line x1={side * 16} y1={-104} x2={end[0]} y2={end[1]} stroke={INK} strokeWidth={12} strokeLinecap="round" />
        <line x1={side * 16} y1={-104} x2={end[0]} y2={end[1]} stroke={SKIN} strokeWidth={7} strokeLinecap="round" />
        {sword && side > 0 ? (
          <g>
            <line x1={end[0]} y1={end[1]} x2={end[0] + 14} y2={end[1] - 78} stroke={INK} strokeWidth={11} strokeLinecap="round" />
            <line x1={end[0]} y1={end[1]} x2={end[0] + 14} y2={end[1] - 78} stroke="#dfe3ea" strokeWidth={6} strokeLinecap="round" />
            <line x1={end[0] - 14} y1={end[1] - 6} x2={end[0] + 16} y2={end[1] + 2} stroke={INK} strokeWidth={7} strokeLinecap="round" />
            <line x1={end[0] - 14} y1={end[1] - 6} x2={end[0] + 16} y2={end[1] + 2} stroke={GOLD} strokeWidth={3.5} strokeLinecap="round" />
          </g>
        ) : null}
      </g>
    );
  };
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <g className={cls} style={{ animationDelay: `${delay}s` }}>
        <g className={pose === 'run' ? 'ep-bob' : undefined}>
          {cape ? (
            <path className="ep-flutter" d="M -18 -110 L 18 -110 Q 64 -50 58 -6 Q 0 6 -58 -6 Q -64 -50 -18 -110 Z" fill={cape} stroke={INK} strokeWidth={3} />
          ) : null}
          <g className={pose === 'run' ? 'ep-legA' : undefined}>
            <line x1={-9} y1={-44} x2={-12} y2={-6} stroke={INK} strokeWidth={13} strokeLinecap="round" />
            <line x1={-9} y1={-44} x2={-12} y2={-6} stroke="#2a2320" strokeWidth={8} strokeLinecap="round" />
            <ellipse cx={-15} cy={-4} rx={10} ry={5} fill="#f2eae0" stroke={INK} strokeWidth={2.5} />
          </g>
          <g className={pose === 'run' ? 'ep-legB' : undefined}>
            <line x1={9} y1={-44} x2={12} y2={-6} stroke={INK} strokeWidth={13} strokeLinecap="round" />
            <line x1={9} y1={-44} x2={12} y2={-6} stroke="#2a2320" strokeWidth={8} strokeLinecap="round" />
            <ellipse cx={15} cy={-4} rx={10} ry={5} fill="#f2eae0" stroke={INK} strokeWidth={2.5} />
          </g>
          <path d="M -20 -112 L 20 -112 L 26 -40 Q 0 -34 -26 -40 Z" fill={shirt} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          {arm(-1)}
          {arm(1)}
          <defs>
            <clipPath id={`ep-face-${k}`}><circle cx={0} cy={-148} r={33} /></clipPath>
          </defs>
          <circle cx={0} cy={-148} r={36} fill="#2a2320" stroke={INK} strokeWidth={3} />
          {h.avatar ? (
            <image href={h.avatar} x={-33} y={-181} width={66} height={66} clipPath={`url(#ep-face-${k})`} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <text x={0} y={-136} textAnchor="middle" fontSize={34} fontWeight={700} fill="#f2eae0">{h.name.slice(0, 1).toUpperCase()}</text>
          )}
          {pose === 'sad' ? <circle cx={0} cy={-148} r={33} fill="#1a1030" opacity={0.35} /> : null}
        </g>
        {label ? <text x={0} y={24} textAnchor="middle" className="ep-label" fontSize={20}>{h.name}</text> : null}
      </g>
    </g>
  );
}

/** Puhekupla (katkoviivalla = sumun kuiskaus). */
function Bubble({ x, y, w, h, tx, ty, lines, size = 26, delay = 0, whisper = false, bang = false }: { x: number; y: number; w: number; h: number; tx: number; ty: number; lines: string[]; size?: number; delay?: number; whisper?: boolean; bang?: boolean }) {
  const below = ty > y + h;
  const by = below ? y + h : y;
  const bx = Math.max(x + 30, Math.min(x + w - 30, tx));
  const fill = whisper ? '#d9d4e3' : '#fff8ee';
  const step = size * 1.15;
  const y0 = y + h / 2 - ((lines.length - 1) * step) / 2 + size * 0.34;
  return (
    <g className="ep-pop" style={{ animationDelay: `${delay}s` }}>
      <polygon points={`${bx - 14},${by} ${bx + 14},${by} ${tx},${ty}`} fill={fill} stroke={INK} strokeWidth={3} strokeDasharray={whisper ? '8 6' : undefined} />
      <rect x={x} y={y} width={w} height={h} rx={Math.min(28, h / 2)} fill={fill} stroke={INK} strokeWidth={3} strokeDasharray={whisper ? '8 6' : undefined} />
      <polygon points={`${bx - 11},${by + (below ? -3 : 3)} ${bx + 11},${by + (below ? -3 : 3)} ${tx},${ty + (below ? -5 : 5)}`} fill={fill} />
      <text x={x + w / 2} y={y0} textAnchor="middle" fontSize={size} className={bang ? 'ep-bang' : 'ep-hand'} fill={whisper ? '#4a3f5c' : INK} fontStyle={whisper ? 'italic' : undefined}>
        {lines.map((t, i) => <tspan key={i} x={x + w / 2} dy={i ? step : 0}>{t}</tspan>)}
      </text>
    </g>
  );
}

/** Kertojan laatikko (sarjakuvan keltainen teksti). */
function Narr({ x, y, w, lines, size = 22, delay = 0 }: { x: number; y: number; w: number; lines: string[]; size?: number; delay?: number }) {
  const h = 16 + lines.length * size * 1.25;
  return (
    <g className="ep-pop" style={{ animationDelay: `${delay}s` }}>
      <rect x={x} y={y} width={w} height={h} fill="#f3e3b0" stroke={INK} strokeWidth={3} />
      <text x={x + 14} y={y + 6 + size} fontSize={size} className="ep-narr" fill={INK}>
        {lines.map((t, i) => <tspan key={i} x={x + 14} dy={i ? size * 1.25 : 0}>{t}</tspan>)}
      </text>
    </g>
  );
}

function Pow({ x, y, text, delay = 0, size = 44 }: { x: number; y: number; text: string; delay?: number; size?: number }) {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const r = i % 2 ? size * 0.9 : size * 1.6;
    const a = (i / 16) * Math.PI * 2;
    return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r * 0.75).toFixed(1)}`;
  }).join(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      <g className="ep-pop" style={{ animationDelay: `${delay}s` }}>
        <polygon points={pts} fill={GOLD} stroke={INK} strokeWidth={3} />
        <text y={size * 0.34} textAnchor="middle" fontSize={size} className="ep-bang" fill="#7d1812">{text}</text>
      </g>
    </g>
  );
}

/** Loppupomon varjo (ei kasvoja eikä nimeä: ei spoilata). */
function Shadow({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M -190 0 C -175 -120 -110 -180 -60 -200 C -85 -250 -100 -310 -130 -380 C -70 -335 -45 -280 -30 -225 C -15 -232 15 -232 30 -225 C 45 -280 70 -335 130 -380 C 100 -310 85 -250 60 -200 C 110 -180 175 -120 190 0 Z" fill="#050303" />
      <ellipse cx={-20} cy={-175} rx={13} ry={5} fill="#ff4a2e" className="ep-glow" />
      <ellipse cx={20} cy={-175} rx={13} ry={5} fill="#ff4a2e" className="ep-glow" />
    </g>
  );
}

/** Monsterin kortti: kuva (tai varjo), nimi ja halutessa HP-palkki, joka hupenee iskuista. */
function MonsterCard({ x, y, w, h, name, image, tag, hp = false, dead = false }: { x: number; y: number; w: number; h: number; name: string; image: string | null; tag?: string; hp?: boolean; dead?: boolean }) {
  const ih = h - 46;
  const max = Math.floor(w / 10.5);
  const short = name.length > max ? `${name.slice(0, max - 1)}…` : name;
  return (
    <g>
      {hp ? (
        <g>
          <rect x={x} y={y - 30} width={w} height={18} rx={9} fill="#2a1512" stroke={INK} strokeWidth={3} />
          <rect className="ep-drain" x={x + 3} y={y - 27} width={w - 6} height={12} rx={6} fill="#c8321f" />
          <text x={x + w / 2} y={y - 16} textAnchor="middle" fontSize={11} className="ep-hand" fill="#fff8ee">HP</text>
        </g>
      ) : null}
      <rect x={x} y={y} width={w} height={h} fill="#f2eae0" stroke={INK} strokeWidth={4} />
      <clipPath id={`ep-card-${x}-${y}`}><rect x={x + 10} y={y + 10} width={w - 20} height={ih} /></clipPath>
      <rect x={x + 10} y={y + 10} width={w - 20} height={ih} fill="#2a2320" />
      {image ? <image href={image} x={x + 10} y={y + 10} width={w - 20} height={ih} preserveAspectRatio="xMidYMid slice" clipPath={`url(#ep-card-${x}-${y})`} /> : <g clipPath={`url(#ep-card-${x}-${y})`}><Shadow x={x + w / 2} y={y + 10 + ih + 30} s={(w - 20) / 420} /></g>}
      {dead ? <text x={x + w / 2} y={y + 10 + ih / 2 + 30} textAnchor="middle" fontSize={90} className="ep-bang" fill="#f2eae0" opacity={0.9}>✝</text> : null}
      <text x={x + w / 2} y={y + h - 14} textAnchor="middle" fontSize={18} className="ep-hand" fill={INK}>{short}</text>
      {tag ? (
        <g transform={`rotate(-4 ${x + 10} ${y})`}>
          <rect x={x + 10} y={y - 4} width={Math.max(90, tag.length * 11 + 20)} height={30} fill={GOLD} stroke={INK} strokeWidth={3} />
          <text x={x + 20} y={y + 17} fontSize={17} className="ep-bang" fill="#7d1812">{tag}</text>
        </g>
      ) : null}
    </g>
  );
}

/** Jahdin portti: kiviholvi, jonka takaa hehkuu valo. */
function Gate({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M -130 0 V -250 Q 0 -400 130 -250 V 0 Z" fill="#4a3f3a" stroke={INK} strokeWidth={4} />
      <path d="M -70 0 V -210 Q 0 -300 70 -210 V 0 Z" fill="url(#ep-gateglow)" stroke={INK} strokeWidth={4} className="ep-glow" />
      {[-205, -150, -95, -40].map((yy) => <g key={yy}><line x1={-130} y1={yy} x2={-70} y2={yy} stroke={INK} strokeWidth={2} opacity={0.5} /><line x1={70} y1={yy} x2={130} y2={yy} stroke={INK} strokeWidth={2} opacity={0.5} /></g>)}
      <text x={0} y={-318} textAnchor="middle" fontSize={22} className="ep-bang" fill={GOLD}>⚔️</text>
      {[-105, 105].map((tx) => (
        <g key={tx}>
          <rect x={tx - 6} y={-190} width={12} height={40} fill="#2a1d18" stroke={INK} strokeWidth={2} />
          <path d={`M ${tx} -222 q -12 18 0 32 q 12 -14 0 -32 Z`} fill="#ffb347" className="ep-flash" />
        </g>
      ))}
    </g>
  );
}

const city = (
  <g>
    {[[0, 110, 230], [100, 90, 300], [180, 120, 210], [290, 80, 280], [360, 130, 230], [480, 100, 320], [570, 120, 240], [680, 120, 290]].map(([x, w, h], i) => (
      <g key={i}>
        <rect x={x} y={400 - h} width={w} height={h} fill={['#2a1d22', '#33232a', '#281b20'][i % 3]} stroke={INK} strokeWidth={3} />
        {Array.from({ length: Math.floor((h - 40) / 36) }, (_, r) => Array.from({ length: Math.floor((w - 30) / 30) }, (_, c) => (
          <rect key={`${r}-${c}`} x={x + 16 + c * 30} y={400 - h + 20 + r * 36} width={14} height={18} rx={2} fill="#f3d27a" opacity={(r * 7 + c * 3 + i) % 4 ? 0.12 : 0.7} />
        )))}
      </g>
    ))}
    <rect y={398} width={800} height={102} fill="#1c1412" />
  </g>
);

/**
 * Sarjakuvajakso Monsterijahdin puolivälistä: ruudut vaihtuvat itsestään, napautus eteen/taakse, ääni napista.
 * Sankarit esiintyvät omilla avatareillaan; tulevia monstereita ei paljasteta.
 */
export default function Episode({ d }: { d: EpisodeData }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  const holdAt = useRef(0);
  useEffect(() => { try { setSound(localStorage.getItem(localKey(SOUND)) === '1'); } catch { /* ei tallennusta */ } }, []);

  const heroes = d.heroes.slice(0, 12);
  const me = heroes.find((h) => h.id === d.me) ?? heroes[0];
  const others = heroes.filter((h) => h.id !== me?.id);
  const row = (count: number, from: number, to: number) => Array.from({ length: count }, (_, n) => (count === 1 ? (from + to) / 2 : from + ((to - from) * n) / (count - 1)));
  const back = heroes.slice(0, Math.ceil(heroes.length / 2));
  const front = heroes.slice(Math.ceil(heroes.length / 2));

  const findHero = (name: string | undefined) => heroes.find((h) => h.name === name);
  const big = d.biggest ? findHero(d.biggest.name) ?? me : null;
  const crew = d.together ? [findHero(d.together.name), ...others].filter((h, n, a): h is EpisodeHero => Boolean(h) && a.indexOf(h) === n).slice(0, Math.min(5, d.together.people)) : [];
  const first = d.fallen[0] ?? null;

  const all: ({ id: string; label: string; ms: number; el: React.ReactNode } | null)[] = [
    {
      id: 'title', label: 'Alkutekstit', ms: 5500,
      el: (
        <>
          <rect width={800} height={500} fill="url(#ep-sky)" />
          <g className="ep-loom"><Shadow x={650} y={420} s={0.62} /></g>
          <g className="ep-pop"><text x={48} y={100} fontSize={18} className="ep-narr" fill={GOLD} letterSpacing={3}>MONSTERIJAHTI ESITTÄÄ · JAKSO {d.episode}</text></g>
          <g className="ep-pop" style={{ animationDelay: '.3s' }}><text x={44} y={190} fontSize={82} className="ep-title" fill="#f2eae0">Puolivälin</text></g>
          <g className="ep-pop" style={{ animationDelay: '.55s' }}><text x={48} y={258} fontSize={64} className="ep-title" fill="#f2eae0">taisto</text></g>
          <g className="ep-pop" style={{ animationDelay: '.9s' }}><text x={50} y={316} fontSize={26} className="ep-hand" fill="#e6ddd2">Pääosissa: {heroes.length} sankaria</text></g>
          {heroes.slice(0, 10).map((h, n) => <Hero key={h.id} h={h} k={`t${n}`} x={60 + n * 76} y={492} s={0.42} pose={n % 2 ? 'wave' : 'up'} sword={n % 2 === 0} cls="ep-pop" delay={1.1 + n * 0.08} />)}
        </>
      ),
    },
    {
      id: 'gate', label: 'Ruutu 1 · Portti', ms: 6500,
      el: (
        <>
          <rect width={800} height={500} fill="url(#ep-sky)" />
          <rect y={430} width={800} height={70} fill="#1c1412" />
          <Gate x={640} y={432} s={1.05} />
          <g className="ep-slideIn">
            {heroes.slice(0, 5).map((h, n) => <Hero key={h.id} h={h} k={`g${n}`} x={90 + n * 92} y={474 - (n % 2) * 10} s={0.58} pose="run" cape={CAPES[n % 5]} />)}
          </g>
          <Narr x={20} y={18} w={440} lines={[`${d.gateDay} portti aukesi.`, `${heroes.length} sankaria lähti jahtiin.`]} delay={0.3} />
          {me ? <Bubble x={40} y={150} w={250} h={54} tx={140} ty={300} lines={['Jahti alkaa!']} size={28} bang delay={2.2} /> : null}
        </>
      ),
    },
    {
      id: 'strike', label: 'Ruutu 2 · Isku', ms: 6500,
      el: (
        <>
          <rect width={800} height={500} fill="#2a1512" />
          <MonsterCard x={480} y={120} w={290} h={260} name={first?.name ?? 'Viikon 1 monsteri'} image={first?.image ?? null} tag="VIIKKO 1" hp />
          {me ? <Hero h={me} k="s-me" x={170} y={470} s={0.95} pose="up" sword /> : null}
          {[['🏋️ TREENI', 0.8], ['👟 ASKELEET', 2.0], ['⚔️ ISKU', 3.2]].map(([t, delay], n) => (
            <g key={n} className="ep-fly" style={{ animationDelay: `${delay}s` }}>
              <rect x={230} y={200 + n * 34} width={150} height={36} rx={18} fill="#fff8ee" stroke={INK} strokeWidth={3} />
              <text x={305} y={225 + n * 34} textAnchor="middle" fontSize={18} className="ep-bang" fill="#7d1812">{t}</text>
            </g>
          ))}
          {['POW!', 'BAM!', 'KRAK!'].map((t, n) => <Pow key={n} x={600 + (n - 1) * 70} y={210 + n * 40} text={t} size={26} delay={1.6 + n * 1.2} />)}
          <Narr x={20} y={18} w={420} lines={['Jokainen treeni on isku.', 'Jokainen askelpäivä myös.']} delay={0.2} />
          <g className="ep-pop" style={{ animationDelay: '4.4s' }}>
            <rect x={330} y={420} width={450} height={56} rx={14} fill="#fff8ee" stroke={INK} strokeWidth={3} />
            <text x={555} y={455} textAnchor="middle" fontSize={20} className="ep-hand" fill={INK}>{fmt(d.trainings)} treeniä · {fmt(d.stepDays)} askelpäivää · {fmt(d.damage)} voimaa</text>
          </g>
        </>
      ),
    },
    d.biggest || d.together ? {
      id: 'peak', label: 'Ruutu 3 · Kovimmat iskut', ms: 7000,
      el: (
        <>
          <rect width={800} height={500} fill="#3a1410" />
          <rect x={400} width={400} height={500} fill="#2a1512" />
          <line x1={404} y1={0} x2={396} y2={500} stroke={INK} strokeWidth={8} />
          {d.biggest && big ? (
            <g>
              <Narr x={16} y={16} w={370} lines={['Kauden kovin isku:', `${d.biggest.name} · ${d.biggest.sport} ${d.biggest.minutes} min`.slice(0, 34)]} size={20} />
              <Pow x={200} y={200} text={`${fmt(d.biggest.damage)}!`} size={42} delay={1} />
              <Hero h={big} k="p-big" x={200} y={486} s={0.78} pose="up" sword cls="ep-pop" delay={0.4} />
            </g>
          ) : null}
          {d.together ? (
            <g>
              <Narr x={416} y={16} w={370} lines={['Isoin yhteistreeni:', `${d.together.people} sankaria · ${d.together.sport}`.slice(0, 34)]} size={20} delay={2} />
              <Pow x={600} y={200} text={`${fmt(d.together.damage)}!`} size={42} delay={3} />
              {crew.map((h, n) => <Hero key={h.id} h={h} k={`p${n}`} x={row(crew.length, 470, 730)[n]} y={480} s={0.5} pose={n % 2 ? 'wave' : 'up'} cls="ep-pop" delay={2.4 + n * 0.12} />)}
            </g>
          ) : null}
        </>
      ),
    } : null,
    d.fallen.length ? {
      id: 'fallen', label: 'Ruutu 4 · Kaatuneet', ms: Math.max(6500, 3000 + d.fallen.length * 700),
      el: (
        <>
          <rect width={800} height={500} fill="#3a1410" />
          <Narr x={20} y={14} w={460} lines={[`${d.fallen.length} monsteria kaatunut. Viimeinen isku:`]} size={20} />
          {d.fallen.slice(0, 6).map((f, n) => {
            const cx = 140 + (n % 3) * 260;
            const cy = 74 + Math.floor(n / 3) * 212;
            return (
              <g key={n} className="ep-pop" style={{ animationDelay: `${0.4 + n * 0.6}s` }}>
                <g transform={`rotate(${n % 2 ? 2 : -2} ${cx} ${cy + 80})`}>
                  <MonsterCard x={cx - 100} y={cy} w={200} h={160} name={f.name} image={f.image} dead />
                </g>
                {f.blow ? (
                  <g>
                    <rect x={cx - 100} y={cy + 166} width={200} height={32} rx={16} fill={GOLD} stroke={INK} strokeWidth={3} />
                    <text x={cx} y={cy + 188} textAnchor="middle" fontSize={17} className="ep-hand" fill={INK}>⚔️ {f.blow.length > 16 ? `${f.blow.slice(0, 15)}…` : f.blow}</text>
                  </g>
                ) : null}
                <Pow x={cx + 70} y={cy + 18} text={['POW!', 'BAM!', 'KRAK!', 'BOOM!', 'ZÄP!', 'TÖMPS!'][n]} size={20} delay={0.7 + n * 0.6} />
              </g>
            );
          })}
        </>
      ),
    } : null,
    d.patrols || d.jointTrainings ? {
      id: 'patrol', label: 'Ruutu 5 · Partio', ms: 6500,
      el: (
        <>
          <rect width={800} height={500} fill="url(#ep-dusk)" />
          {city}
          <g className="ep-slideIn">
            <line x1={640} y1={470} x2={640} y2={230} stroke={INK} strokeWidth={8} />
            <path className="ep-flutter" d="M 640 232 L 750 248 L 640 288 Z" fill="#b3261e" stroke={INK} strokeWidth={3} />
            <text x={676} y={266} fontSize={20}>⚔️</text>
            {heroes.slice(0, 6).map((h, n) => <Hero key={h.id} h={h} k={`pa${n}`} x={590 - n * 64} y={478 - (n % 2) * 10} s={0.5} pose="run" />)}
          </g>
          <Narr x={20} y={18} w={500} lines={[`${fmt(d.patrols)} partiopäivää · ${fmt(d.jointTrainings)} yhteistreeniä.`, 'Yhdessä lyödään kovempaa.']} delay={0.4} />
        </>
      ),
    } : null,
    d.pledges ? {
      id: 'seal', label: 'Ruutu 6 · Lupaus', ms: 6000,
      el: (
        <>
          <rect width={800} height={500} fill="#2a1a12" />
          <rect x={150} y={40} width={500} height={420} rx={10} fill="#f3e3b0" stroke={INK} strokeWidth={4} />
          <text x={400} y={110} textAnchor="middle" fontSize={44} className="ep-title" fill="#7d1812">Lupaus</text>
          <text x={400} y={150} textAnchor="middle" fontSize={20} className="ep-narr" fill={INK}>viikko viikolta, tunti tunnilta</text>
          <g className="ep-pop" style={{ animationDelay: '.4s' }}><text x={330} y={270} textAnchor="middle" fontSize={84} className="ep-bang" fill={INK}>{d.kept}/{d.pledges}</text></g>
          <text x={330} y={312} textAnchor="middle" fontSize={22} className="ep-hand" fill={INK}>lupausviikkoa pidetty</text>
          <g transform="translate(540,300)">
            <g className="ep-stamp" style={{ animationDelay: '1.2s' }}>
              <circle r={68} fill="#9e1f16" stroke={INK} strokeWidth={4} />
              <circle r={54} fill="none" stroke="#e8846f" strokeWidth={3} strokeDasharray="6 5" />
              <text y={10} textAnchor="middle" fontSize={21} className="ep-bang" fill="#ffe7da" transform="rotate(-12)">PIDETTY</text>
            </g>
          </g>
          <g className="ep-pop" style={{ animationDelay: '2.4s' }}><text x={400} y={420} textAnchor="middle" fontSize={20} className="ep-narr" fill={INK}>Jokainen pidetty lupaus kasvattaa Ensi-iskua.</text></g>
        </>
      ),
    } : null,
    {
      id: 'now', label: `Ruutu 7 · Viikko ${d.week}`, ms: 7000,
      el: (
        <>
          <rect width={800} height={500} fill="url(#ep-red)" />
          <g className={d.current ? 'ep-recoil' : undefined}>
            <MonsterCard x={470} y={70} w={300} h={290} name={d.current?.name ?? `Viikon ${d.week} monsteri`} image={d.current?.image ?? null} tag={`VIIKKO ${d.week}`} dead={!d.current} />
          </g>
          {back.map((h, n) => <Hero key={h.id} h={h} k={`nb${n}`} x={row(back.length, 50, 400)[n]} y={400} s={0.52} pose="up" sword={n % 2 === 0} cape={CAPES[n % 5]} cls="ep-rushIn" delay={n * 0.1} />)}
          {front.map((h, n) => <Hero key={h.id} h={h} k={`nf${n}`} x={row(front.length, 30, 430)[n]} y={474} s={0.62} pose={n % 2 ? 'wave' : 'up'} sword={n % 2 === 0} cape={CAPES[(n + 2) % 5]} cls="ep-rushIn" delay={0.06 + n * 0.1} />)}
          {d.current ? ['ISKU!', 'POW!'].map((t, n) => <Pow key={n} x={560 + n * 120} y={180 + n * 90} text={t} size={28} delay={1.6 + n * 0.8} />) : null}
          <Bubble x={20} y={20} w={260} h={58} tx={130} ty={250} lines={[`VIIKKO ${d.week}!`]} size={30} bang delay={1.2} />
          <Narr x={470} y={392} w={310} lines={d.current ? [`Viikko ${d.week} käynnissä.`, d.overdue ? `Ja ${d.overdue} rästissä!` : 'Lyödään se nurin!'] : [`Viikon ${d.week} monsteri`, 'on jo kaatunut!']} size={20} delay={2.4} />
        </>
      ),
    },
    {
      id: 'boss', label: 'Ruutu 8 · Loppupomo', ms: 7000,
      el: (
        <>
          <rect width={800} height={500} fill="url(#ep-red)" />
          <g className="ep-loom"><Shadow x={400} y={500} /></g>
          <Narr x={20} y={20} w={360} lines={[`${d.daysLeft} päivää.`, 'Loppupomo odottaa.']} size={30} delay={1.5} />
          <g className="ep-pop" style={{ animationDelay: '2.4s' }}>
            <text x={780} y={440} textAnchor="end" fontSize={34} className="ep-bang" fill="#ffb08a">Ensi-isku: {fmt(d.pot)} ⚔️</text>
          </g>
          <g className="ep-pop" style={{ animationDelay: '3.2s' }}>
            <text x={776} y={476} textAnchor="end" fontSize={16} className="ep-narr" fill="#f2c9b4">Ylijäämävoima ja pidetyt lupaukset kasvattavat sitä.</text>
          </g>
        </>
      ),
    },
    {
      id: 'end', label: 'Lopputekstit', ms: 12000,
      el: (
        <>
          <rect width={800} height={500} fill="url(#ep-sky)" />
          {Array.from({ length: 40 }, (_, n) => {
            const dur = 3.5 + (n % 5) * 0.6;
            return <rect key={n} className="ep-fall" x={(n * 97 + 13) % 800} y={-40} width={8 + (n % 3) * 3} height={12 + (n % 4) * 2} fill={[GOLD, '#b3261e', '#f2eae0', '#3f7d5c'][n % 4]} style={{ ['--d' as string]: `${dur}s`, animationDelay: `-${(n * 0.37) % dur}s` }} />;
          })}
          <g className="ep-pop"><text x={400} y={66} textAnchor="middle" fontSize={40} className="ep-title" fill="#f2eae0">Toinen puolisko alkaa nyt.</text></g>
          <g className="ep-pop" style={{ animationDelay: '.3s' }}><text x={400} y={102} textAnchor="middle" fontSize={22} className="ep-hand" fill="#e6ddd2">{d.current ? `Nyt taistelussa: ${d.current.name}` : 'Jahti jatkuu.'}</text></g>
          {back.map((h, n) => <Hero key={h.id} h={h} k={`eb${n}`} x={row(back.length, 70, 730)[n]} y={290} s={0.5} pose="up" sword label cls="ep-pop" delay={0.5 + n * 0.08} />)}
          {front.map((h, n) => <Hero key={h.id} h={h} k={`ef${n}`} x={row(front.length, 110, 690)[n]} y={448} s={0.55} pose="wave" label cls="ep-pop" delay={0.9 + n * 0.08} />)}
        </>
      ),
    },
  ];
  const scenes = all.filter((x): x is NonNullable<typeof x> => x !== null);

  const last = scenes.length - 1;
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => setI((x) => (x >= last ? 0 : x + 1)), scenes[i].ms);
    return () => clearTimeout(t);
  }, [i, paused, last]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ruudun äänet: portin nousu, iskujen tömähdykset, partion askeleet, sinetti ja loppupomon sydän.
  const id = scenes[i].id;
  useEffect(() => {
    if (!sound) return;
    startSound();
    stopHeartbeat();
    if (id === 'title') setDread(1);
    if (id === 'gate') { setDread(1); riser(2.2); }
    if (id === 'strike') { setDread(2); [1.6, 2.8, 4.0].forEach((t) => thud(t)); }
    if (id === 'peak') { setDread(1); thud(1, 1); thud(3, 1); }
    if (id === 'fallen') { setDread(1); d.fallen.slice(0, 6).forEach((_, n) => thud(0.7 + n * 0.6)); }
    if (id === 'patrol') { setDread(0); for (let n = 0; n < 8; n++) thud(0.4 + n * 0.45, 0.25); }
    if (id === 'seal') { setDread(0); thud(1.45, 1); }
    if (id === 'now') { setDread(2); riser(1.4); thud(1.6); thud(2.4); }
    if (id === 'boss') { setDread(3); heartbeat(6); }
    if (id === 'end') setDread(0);
  }, [sound, id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSound(), []);

  const toggleSound = () => {
    const on = !sound;
    setSound(on);
    try { localStorage.setItem(localKey(SOUND), on ? '1' : '0'); } catch { /* ei tallennusta */ }
    if (on) startSound(); else stopSound();
  };
  const tap = (e: React.PointerEvent<HTMLDivElement>) => {
    setPaused(false);
    if (Date.now() - holdAt.current > 350) return;
    const r = e.currentTarget.getBoundingClientRect();
    const left = e.clientX - r.left < r.width / 3;
    setI((x) => (left ? Math.max(0, x - 1) : x >= last ? 0 : x + 1));
  };

  return (
    <div className="ep">
      <div className="ep-screen" onPointerDown={() => { holdAt.current = Date.now(); setPaused(true); }} onPointerUp={tap} onPointerCancel={() => setPaused(false)}>
        <svg key={i} viewBox="0 0 800 500" className={`ep-svg${paused ? ' paused' : ''}`} role="img" aria-label={scenes[i].label}>
          <defs>
            <linearGradient id="ep-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a1410" /><stop offset="1" stopColor="#120c0a" /></linearGradient>
            <linearGradient id="ep-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a2418" /><stop offset=".7" stopColor="#c2562c" /><stop offset="1" stopColor="#e8a27a" /></linearGradient>
            <radialGradient id="ep-red" cx=".5" cy=".7" r=".8"><stop offset="0" stopColor="#7d1812" /><stop offset="1" stopColor="#0e0807" /></radialGradient>
            <radialGradient id="ep-flashg"><stop offset="0" stopColor="#fff" /><stop offset=".5" stopColor="#b3261e" stopOpacity=".5" /><stop offset="1" stopColor="#b3261e" stopOpacity="0" /></radialGradient>
            <linearGradient id="ep-gateglow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe9a8" /><stop offset="1" stopColor="#c2562c" /></linearGradient>
          </defs>
          {scenes[i].el}
        </svg>
        <div className="ep-bar"><span key={i} style={{ animationDuration: `${scenes[i].ms}ms`, animationPlayState: paused ? 'paused' : 'running' }} /></div>
      </div>
      <div className="ep-controls">
        <button type="button" className="btn btn-ghost btn-compact" aria-label="Edellinen ruutu" onClick={() => setI((x) => Math.max(0, x - 1))}>◀</button>
        <button type="button" className="btn btn-ghost btn-compact" onClick={() => setPaused((p) => !p)}>{paused ? '▶ Jatka' : '⏸ Tauko'}</button>
        <button type="button" className="btn btn-ghost btn-compact" aria-label="Seuraava ruutu" onClick={() => setI((x) => (x >= last ? 0 : x + 1))}>▶</button>
        <button type="button" className="btn btn-ghost btn-compact" aria-pressed={sound} onClick={toggleSound}>{sound ? '🔊 Ääni' : '🔇 Ääni'}</button>
      </div>
      <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>{scenes[i].label} · napauta ruutua siirtyäksesi, pidä pohjassa pysäyttääksesi</p>
    </div>
  );
}
