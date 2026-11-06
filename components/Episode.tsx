'use client';
import { useEffect, useRef, useState } from 'react';
import { localKey } from '@/lib/localKey';
import { heartbeat, riser, setDread, startSound, stopHeartbeat, stopSound, thud } from '@/lib/storySound';

export type EpisodeHero = { id: string; name: string; avatar: string | null };
export type EpisodeData = {
  episode: number;
  heroes: EpisodeHero[];
  me: string | null;
  fallen: { name: string; image: string | null }[];
  current: string | null;
  trainings: number;
  stepDays: number;
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
function Hero({ h, k, x, y, s = 1, pose = 'down', cape, cls = '', delay = 0, label = false }: { h: EpisodeHero; k: string; x: number; y: number; s?: number; pose?: Pose; cape?: string; cls?: string; delay?: number; label?: boolean }) {
  const shirt = SHIRTS[h.name.length % SHIRTS.length];
  const arm = (side: number) => {
    const end = pose === 'up' ? [side * 34, -200] : pose === 'wave' ? (side > 0 ? [40, -190] : [-30, -70]) : pose === 'run' ? [side * 30, side > 0 ? -140 : -80] : pose === 'sad' ? [side * 14, -72] : [side * 28, -66];
    return (
      <g className={pose === 'wave' && side > 0 ? 'ep-wave' : undefined}>
        <line x1={side * 16} y1={-104} x2={end[0]} y2={end[1]} stroke={INK} strokeWidth={12} strokeLinecap="round" />
        <line x1={side * 16} y1={-104} x2={end[0]} y2={end[1]} stroke={SKIN} strokeWidth={7} strokeLinecap="round" />
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

/** Väsymyksen sumu: pehmeä harmaa möykky, ilkeä (tai heikko) naama. */
function Fog({ x, y, s = 1, weak = false, cls = '' }: { x: number; y: number; s?: number; weak?: boolean; cls?: string }) {
  const blobs: [number, number, number][] = [[-62, 4, 48], [-10, -24, 60], [52, 0, 52], [-30, 32, 44], [30, 34, 46], [90, 26, 34], [-92, 30, 30]];
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <g className={cls}>
        <g className="ep-drift">
          <g opacity={0.92} filter="url(#ep-soft)">{blobs.map(([bx, by, r], i) => <circle key={i} cx={bx} cy={by} r={r} fill="#8d8798" />)}</g>
          {weak ? (
            <>
              <path d="M -30 -4 l 12 6 l -12 6 M 30 -4 l -12 6 l 12 6" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
              <path d="M -12 26 q 6 -6 12 0 q 6 6 12 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M -36 -14 L -12 -6 M 36 -14 L 12 -6" stroke={INK} strokeWidth={4} strokeLinecap="round" />
              <ellipse cx={-22} cy={2} rx={7} ry={4.5} fill="#ff4a2e" />
              <ellipse cx={22} cy={2} rx={7} ry={4.5} fill="#ff4a2e" />
              <path d="M -14 24 Q 0 16 14 24" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
            </>
          )}
        </g>
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

const room = (
  <g>
    <rect width={800} height={500} fill="#241a2e" />
    <rect y={420} width={800} height={80} fill="#18111f" />
    <rect x={540} y={60} width={200} height={210} rx={6} fill="#120d22" stroke="#5f4f78" strokeWidth={8} />
    <circle cx={690} cy={110} r={22} fill="#efe6c8" />
    <circle cx={700} cy={103} r={19} fill="#120d22" />
    <rect x={170} y={320} width={300} height={100} rx={22} fill="#5c3b4f" stroke={INK} strokeWidth={3} />
    <rect x={150} y={380} width={340} height={56} rx={16} fill="#6e4660" stroke={INK} strokeWidth={3} />
    <rect x={140} y={350} width={44} height={86} rx={16} fill="#5c3b4f" stroke={INK} strokeWidth={3} />
    <rect x={456} y={350} width={44} height={86} rx={16} fill="#5c3b4f" stroke={INK} strokeWidth={3} />
  </g>
);

/**
 * Sarjakuvajakso: ruudut vaihtuvat itsestään, napautus eteen/taakse, ääni napista.
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
  const pick = (n: number) => others[n % Math.max(1, others.length)] ?? me;
  const row = (count: number, from: number, to: number) => Array.from({ length: count }, (_, n) => (count === 1 ? (from + to) / 2 : from + ((to - from) * n) / (count - 1)));
  const back = heroes.slice(0, Math.ceil(heroes.length / 2));
  const front = heroes.slice(Math.ceil(heroes.length / 2));

  const scenes: { id: string; label: string; ms: number; el: React.ReactNode }[] = [
    {
      id: 'title', label: 'Alkutekstit', ms: 5500,
      el: (
        <>
          <rect width={800} height={500} fill="url(#ep-sky)" />
          <g className="ep-pop"><text x={48} y={100} fontSize={18} className="ep-narr" fill={GOLD} letterSpacing={3}>MONSTERIJAHTI ESITTÄÄ · JAKSO {d.episode}</text></g>
          <g className="ep-pop" style={{ animationDelay: '.3s' }}><text x={44} y={190} fontSize={82} className="ep-title" fill="#f2eae0">Puolivälin</text></g>
          <g className="ep-pop" style={{ animationDelay: '.55s' }}><text x={48} y={258} fontSize={64} className="ep-title" fill="#f2eae0">sumu</text></g>
          <g className="ep-pop" style={{ animationDelay: '.9s' }}><text x={50} y={316} fontSize={26} className="ep-hand" fill="#e6ddd2">Pääosissa: {heroes.length} sankaria</text></g>
          <Fog x={640} y={210} s={0.9} cls="ep-drift" />
          {heroes.slice(0, 10).map((h, n) => <Hero key={h.id} h={h} k={`t${n}`} x={60 + n * 76} y={492} s={0.42} pose={n % 2 ? 'wave' : 'up'} cls="ep-pop" delay={1.1 + n * 0.08} />)}
        </>
      ),
    },
    {
      id: 'montage', label: 'Ruutu 1', ms: 7000,
      el: (
        <>
          <rect width={800} height={500} fill="url(#ep-dusk)" />
          {city}
          <g className="ep-slideIn">
            <g className="ep-speed"><path d="M 260 340 h -80 M 250 370 h -100 M 265 400 h -70" stroke="#f2eae0" strokeWidth={4} strokeLinecap="round" opacity={0.6} /></g>
            {heroes.slice(0, 5).map((h, n) => <Hero key={h.id} h={h} k={`m${n}`} x={300 + n * 95} y={478 - (n % 2) * 12} s={0.62} pose="run" />)}
          </g>
          <Narr x={20} y={18} w={470} lines={['Kaupungissa, jossa sohva kutsuu,', `${heroes.length} sankaria ei jää kotiin.`]} delay={0.2} />
          {[[`${fmt(d.trainings)} treeniä ✓`, 1.6], [`${fmt(d.stepDays)} askelpäivää ✓`, 2.3], [`${fmt(d.damage)} voimaa ✓`, 3.0]].map(([t, delay], n) => (
            <g key={n} className="ep-pop" style={{ animationDelay: `${delay}s` }}>
              <rect x={30} y={120 + n * 52} width={250} height={40} rx={20} fill="#fff8ee" stroke={INK} strokeWidth={3} />
              <text x={155} y={148 + n * 52} textAnchor="middle" fontSize={22} className="ep-hand" fill={INK}>{t}</text>
            </g>
          ))}
        </>
      ),
    },
    {
      id: 'pow', label: 'Ruutu 2', ms: Math.max(6000, 2500 + d.fallen.length * 700),
      el: (
        <>
          <rect width={800} height={500} fill="#3a1410" />
          <Narr x={20} y={16} w={420} lines={[`${d.fallen.length} monsteria on jo kaatunut.`]} />
          {d.fallen.slice(0, 6).map((f, n) => {
            const cx = 70 + (n % 3) * 230 + 70;
            const cy = 110 + Math.floor(n / 3) * 190;
            return (
              <g key={n} className="ep-pop" style={{ animationDelay: `${0.4 + n * 0.6}s` }}>
                <rect x={cx - 95} y={cy} width={190} height={160} fill="#f2eae0" stroke={INK} strokeWidth={4} transform={`rotate(${n % 2 ? 2 : -2} ${cx} ${cy + 80})`} />
                {f.image ? <image href={f.image} x={cx - 85} y={cy + 10} width={170} height={115} preserveAspectRatio="xMidYMid slice" /> : <rect x={cx - 85} y={cy + 10} width={170} height={115} fill="#2a2320" />}
                <text x={cx} y={cy + 148} textAnchor="middle" fontSize={16} className="ep-hand" fill={INK}>{f.name.length > 22 ? `${f.name.slice(0, 21)}…` : f.name}</text>
                <Pow x={cx + 60} y={cy + 20} text={['POW!', 'BAM!', 'KRAK!', 'BOOM!', 'ZÄP!', 'TÖMPS!'][n]} size={22} delay={0.7 + n * 0.6} />
              </g>
            );
          })}
        </>
      ),
    },
    {
      id: 'fog', label: 'Ruutu 3', ms: 6500,
      el: (
        <>
          {room}
          {me ? <Hero h={me} k="f-me" x={320} y={470} s={1} pose="down" /> : null}
          <Fog x={560} y={220} s={1.15} cls="ep-creep" />
          <Bubble x={30} y={30} w={430} h={120} tx={480} ty={210} lines={['Puolet vasta takana…', 'Sohva on niin pehmeä…']} size={30} whisper delay={1.8} />
        </>
      ),
    },
    {
      id: 'doubt', label: 'Ruutu 4', ms: 5500,
      el: (
        <>
          {room}
          <Fog x={150} y={130} s={0.9} />
          <Fog x={560} y={210} s={1.6} />
          <rect width={800} height={500} fill="#0b0712" opacity={0.3} />
          {me ? <Hero h={me} k="d-me" x={330} y={466} s={1} pose="sad" cls="ep-shrink" /> : null}
          <Bubble x={60} y={30} w={420} h={70} tx={330} ty={300} lines={['Huomenna sitten?']} size={28} whisper delay={0.6} />
          <Bubble x={380} y={318} w={100} h={38} tx={352} ty={362} lines={['…ehkä.']} size={20} delay={2.6} />
        </>
      ),
    },
    {
      id: 'alarm', label: 'Ruutu 5', ms: 6500,
      el: (
        <>
          <rect width={800} height={500} fill="#1c1018" />
          <circle className="ep-flash" cx={400} cy={250} r={330} fill="url(#ep-flashg)" />
          <g className="ep-shake"><text x={120} y={140} fontSize={50} className="ep-bang" fill={GOLD}>BZZZT!</text></g>
          <g className="ep-shake" style={{ animationDelay: '.6s' }}><text x={600} y={420} fontSize={50} className="ep-bang" fill={GOLD}>BZZZT!</text></g>
          <g transform="translate(400,250)">
            <g className="ep-pop">
              <rect x={-132} y={-236} width={264} height={472} rx={34} fill="#120c10" stroke={GOLD} strokeWidth={5} />
              <rect x={-116} y={-206} width={232} height={412} rx={18} fill="#f7efe6" />
              <rect x={-116} y={-206} width={232} height={56} fill="#7d1812" />
              <text x={0} y={-172} textAnchor="middle" fontSize={22} className="ep-hand" fill="#fff">Monsterijahti ⚔️</text>
              <g className="ep-pop" style={{ animationDelay: '.5s' }}>
                <rect x={-104} y={-132} width={208} height={84} rx={18} fill="#b3261e" stroke={INK} strokeWidth={2.5} />
                <text x={0} y={-98} textAnchor="middle" fontSize={24} className="ep-bang" fill="#fff"><tspan x={0}>@all 🚨</tspan><tspan x={0} dy={28}>SUMUHÄLYTYS</tspan></text>
              </g>
              {[[`${pick(0).name}: tulossa!!`, -20, 1.4], [`${pick(1).name}: lenkkarit jalkaan 🏃`, 30, 2.0], [`${pick(2).name}: viitta päälle 🦸`, 80, 2.6]].map(([t, y, delay], n) => (
                <g key={n} className="ep-pop" style={{ animationDelay: `${delay}s` }}>
                  <rect x={-104} y={Number(y)} width={208} height={38} rx={14} fill="#d9eadf" stroke={INK} strokeWidth={2} />
                  <text x={0} y={Number(y) + 25} textAnchor="middle" fontSize={15} className="ep-hand" fill={INK}>{String(t).length > 26 ? `${String(t).slice(0, 25)}…` : t}</text>
                </g>
              ))}
            </g>
          </g>
        </>
      ),
    },
    {
      id: 'rush', label: 'Ruutu 6', ms: 7000,
      el: (
        <>
          {room}
          <g className="ep-recoil"><Fog x={660} y={210} s={1.2} weak /></g>
          {back.map((h, n) => <Hero key={h.id} h={h} k={`rb${n}`} x={row(back.length, 60, 470)[n]} y={400} s={0.56} pose="up" cape={CAPES[n % 5]} cls="ep-rushIn" delay={n * 0.1} />)}
          {front.map((h, n) => <Hero key={h.id} h={h} k={`rf${n}`} x={row(front.length, 40, 500)[n]} y={474} s={0.66} pose={n % 2 ? 'wave' : 'up'} cape={CAPES[(n + 2) % 5]} cls="ep-rushIn" delay={0.06 + n * 0.1} />)}
          <Bubble x={14} y={24} w={210} h={54} tx={110} ty={270} lines={['VIIKKO 7!']} size={28} bang delay={1.3} />
          <Bubble x={240} y={24} w={250} h={54} tx={330} ty={270} lines={['SINETTI TÄYTEEN!']} size={26} bang delay={1.7} />
          <Bubble x={110} y={100} w={250} h={54} tx={230} ty={280} lines={['ENSI-ISKU KASVAA!']} size={26} bang delay={2.1} />
          <Bubble x={520} y={20} w={260} h={84} tx={640} ty={130} lines={['Ei… liikaa…', 'treeniä…']} size={26} whisper delay={3.0} />
        </>
      ),
    },
    {
      id: 'dawn', label: 'Ruutu 7', ms: 6000,
      el: (
        <>
          {room}
          <rect className="ep-dawn" width={800} height={500} fill="#e8a27a" />
          <g className="ep-evap"><Fog x={660} y={210} s={1.2} weak /></g>
          {back.map((h, n) => <Hero key={h.id} h={h} k={`db${n}`} x={row(back.length, 60, 470)[n]} y={400} s={0.56} pose="up" cape={CAPES[n % 5]} />)}
          {front.map((h, n) => <Hero key={h.id} h={h} k={`df${n}`} x={row(front.length, 40, 500)[n]} y={474} s={0.66} pose="wave" cape={CAPES[(n + 2) % 5]} />)}
          <Bubble x={200} y={24} w={560} h={110} tx={420} ty={300} lines={['Sumu ei pärjää porukalle.', 'Toinen puolisko on meidän.']} size={34} delay={1.2} />
        </>
      ),
    },
    {
      id: 'boss', label: 'Ruutu 8', ms: 6500,
      el: (
        <>
          <rect width={800} height={500} fill="url(#ep-red)" />
          <g className="ep-loom">
            <path d="M 210 500 C 225 380 290 320 340 300 C 315 250 300 190 270 120 C 330 165 355 220 370 275 C 385 268 415 268 430 275 C 445 220 470 165 530 120 C 500 190 485 250 460 300 C 510 320 575 380 590 500 Z" fill="#050303" />
            <ellipse cx={380} cy={325} rx={13} ry={5} fill="#ff4a2e" className="ep-glow" />
            <ellipse cx={420} cy={325} rx={13} ry={5} fill="#ff4a2e" className="ep-glow" />
          </g>
          <Narr x={20} y={20} w={360} lines={[`${d.daysLeft} päivää.`, 'Se odottaa.']} size={30} delay={1.5} />
          <g className="ep-pop" style={{ animationDelay: '2.4s' }}>
            <text x={780} y={470} textAnchor="end" fontSize={34} className="ep-bang" fill="#ffb08a">Ensi-isku: {fmt(d.pot)} ⚔️</text>
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
          <g className="ep-pop" style={{ animationDelay: '.3s' }}><text x={400} y={102} textAnchor="middle" fontSize={22} className="ep-hand" fill="#e6ddd2">{d.current ? `Nyt taistelussa: ${d.current}` : 'Jatkuu maanantaina klo 00.'}</text></g>
          {back.map((h, n) => <Hero key={h.id} h={h} k={`eb${n}`} x={row(back.length, 70, 730)[n]} y={290} s={0.5} pose="up" label cls="ep-pop" delay={0.5 + n * 0.08} />)}
          {front.map((h, n) => <Hero key={h.id} h={h} k={`ef${n}`} x={row(front.length, 110, 690)[n]} y={448} s={0.55} pose="wave" label cls="ep-pop" delay={0.9 + n * 0.08} />)}
        </>
      ),
    },
  ];

  const last = scenes.length - 1;
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => setI((x) => (x >= last ? 0 : x + 1)), scenes[i].ms);
    return () => clearTimeout(t);
  }, [i, paused, last]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ruudun äänet: sumu huminana, POW-tömähdykset, hälytys, rynnäkkö ja loppupomon sydän.
  const id = scenes[i].id;
  useEffect(() => {
    if (!sound) return;
    startSound();
    stopHeartbeat();
    if (id === 'title' || id === 'montage') setDread(1);
    if (id === 'pow') { setDread(1); d.fallen.slice(0, 6).forEach((_, n) => thud(0.7 + n * 0.6)); }
    if (id === 'fog' || id === 'doubt') setDread(3);
    if (id === 'alarm') { setDread(2); [0, 0.25, 0.6, 0.85].forEach((t) => thud(t, 0.5)); }
    if (id === 'rush') { setDread(2); riser(1.4); }
    if (id === 'dawn' || id === 'end') setDread(0);
    if (id === 'boss') { setDread(3); heartbeat(6); }
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
            <filter id="ep-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter>
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
