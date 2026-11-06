'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { localKey } from '@/lib/localKey';
// @ts-expect-error react-dom-tyyppejä ei ole asennettu; createPortal on Nextin mukana.
import { createPortal } from 'react-dom';

export type StoryData = {
  untilLabel: string;
  started: number;
  damage: number;
  trainings: number;
  stepDays: number;
  patrols: number;
  pot: number;
  daysLeft: number;
  fallen: { week: number; name: string; image: string | null; day: string; blow: string | null }[];
  race: { id: string; name: string; avatar: string | null; cum: number[] }[];
  raceWeeks: number[];
  biggest: { name: string; sport: string; minutes: number; damage: number } | null;
  together: { name: string; people: number; sport: string; damage: number } | null;
  bestDay: { day: string; damage: number } | null;
  seasonPct: number;
  powerPct: number | null;
  own: { damage: number; rank: number; of: number; trainings: number; kept: number; closed: number; best: string | null; badges: string[] } | null;
};

const fmt = (n: number) => n.toLocaleString('fi-FI');
const dm = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
const SEEN = 'mj_mid_story_seen';
const RACE_STEP_MS = 1300;

/** Luku rullaa nollasta tavoitteeseen (liikettä vähentävillä heti valmis). */
function Counter({ to, ms = 1800 }: { to: number; ms?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setN(to);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return <>{fmt(n)}</>;
}

/** Voimakisa: sankarien palkit kasvavat viikko viikolta, ja järjestys vaihtuu liukuen. */
function Race({ race, weeks, paused }: { race: StoryData['race']; weeks: number[]; paused: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setI(weeks.length - 1);
    if (paused || i >= weeks.length - 1) return;
    const t = window.setTimeout(() => setI((x) => x + 1), RACE_STEP_MS);
    return () => clearTimeout(t);
  }, [i, paused, weeks.length]);
  const max = Math.max(1, ...race.map((r) => r.cum[i] ?? 0));
  const order = [...race].sort((a, c) => (c.cum[i] ?? 0) - (a.cum[i] ?? 0)).map((r) => r.id);
  return (
    <div className="ms-race">
      <div className="ms-race-week">Viikko {weeks[i]}</div>
      <div className="ms-race-rows" style={{ height: race.length * 34 }}>
        {race.map((r) => {
          const rank = order.indexOf(r.id);
          const v = r.cum[i] ?? 0;
          return (
            <div key={r.id} className="ms-race-row" style={{ transform: `translateY(${rank * 34}px)` }}>
              <span className="ms-race-rank">{rank + 1}.</span>
              {r.avatar ? <img src={r.avatar} alt="" /> : <b>{r.name.slice(0, 1)}</b>}
              <span className="ms-race-track"><span className="ms-race-bar" style={{ width: `${Math.max(2, (v / max) * 100)}%` }}><span>{r.name}</span></span></span>
              <span className="ms-race-num">{fmt(v)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Puolivälin tarina: koko ruudun kortit vaihtuvat itsestään (napautus oikealle = seuraava, vasemmalle = edellinen,
 * painallus pitää tauolla). Avautuu itsestään ensimmäisellä käynnillä; myöhemmin napista.
 */
export default function MidseasonStory({ d }: { d: StoryData }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const holdAt = useRef(0);

  useEffect(() => {
    try { if (!localStorage.getItem(localKey(SEEN))) setOpen(true); } catch { /* ei tallennusta */ }
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(localKey(SEEN), '1'); } catch { /* ei tallennusta */ }
  }, []);

  const slides: { ms: number; el: React.ReactNode }[] = [
    {
      ms: 4500,
      el: (
        <div className="ms-slide ms-intro">
          <span className="ms-kicker">Monsterijahti</span>
          <h2 className="display ms-huge">Puolet takana</h2>
          <div className="ms-calendar"><span>{d.started}</span><small>viikkoa</small></div>
          <p>{fmt(d.trainings)} treeniä · {d.untilLabel} asti</p>
        </div>
      ),
    },
    {
      ms: Math.max(5000, 1800 + d.fallen.length * 700),
      el: (
        <div className="ms-slide">
          <span className="ms-kicker">Kaatuneet</span>
          <h2 className="display">{d.fallen.length}/{d.started} monsteria kaatui</h2>
          {d.fallen.length ? (
            <div className="ms-fallen">
              {d.fallen.map((f, n) => (
                <div key={f.week} className="ms-fallen-card" style={{ animationDelay: `${0.3 + n * 0.6}s` }}>
                  <div className="ms-fallen-img">{f.image ? <img src={f.image} alt="" /> : null}<i style={{ animationDelay: `${0.7 + n * 0.6}s` }}>✝</i></div>
                  <strong>{f.name}</strong>
                  <span>{dm(f.day)}{f.blow ? ` · ${f.blow}` : ''}</span>
                </div>
              ))}
            </div>
          ) : <p>Yksikään ei ole vielä kaatunut. Toinen puolisko ratkaisee.</p>}
        </div>
      ),
    },
    {
      ms: 6000,
      el: (
        <div className="ms-slide">
          <span className="ms-kicker">Porukan voima</span>
          <div className="ms-huge display ms-counter"><Counter to={d.damage} /></div>
          <p>{fmt(d.trainings)} treeniä · {fmt(d.stepDays)} askelpäivää{d.patrols ? ` · ${d.patrols} megamarssia ⭐` : ''}</p>
          {d.powerPct != null ? (
            <div className="ms-pace">
              <div><span>Kautta kulunut</span><div className="ms-pace-bar"><i style={{ width: `${d.seasonPct}%` }} /></div><b>{d.seasonPct} %</b></div>
              <div><span>Voimaa koko kauden tarpeesta</span><div className="ms-pace-bar power"><i style={{ width: `${d.powerPct}%` }} /></div><b>{d.powerPct} %</b></div>
              <strong>{d.powerPct >= d.seasonPct ? '✅ Aikataulussa' : '🔥 Kirittävää jäljellä'}</strong>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      ms: Math.max(6000, d.raceWeeks.length * RACE_STEP_MS + 2500),
      el: (
        <div className="ms-slide">
          <span className="ms-kicker">Voimakisa</span>
          <h2 className="display">Kuka löi eniten?</h2>
          <Race race={d.race} weeks={d.raceWeeks} paused={paused} />
        </div>
      ),
    },
    {
      ms: 6500,
      el: (
        <div className="ms-slide">
          <span className="ms-kicker">Huippuhetket</span>
          <div className="ms-highlights">
            {d.biggest ? <div style={{ animationDelay: '0.2s' }}><span>💥 Isoin isku</span><strong>{fmt(d.biggest.damage)}</strong><small>{d.biggest.name} · {d.biggest.sport} {d.biggest.minutes} min</small></div> : null}
            {d.together ? <div style={{ animationDelay: '0.9s' }}><span>👥 Isoin yhteistreeni</span><strong>{d.together.people} henkeä</strong><small>{d.together.sport} · {fmt(d.together.damage)} voimaa</small></div> : null}
            {d.bestDay ? <div style={{ animationDelay: '1.6s' }}><span>📅 Kovin päivä</span><strong>{fmt(d.bestDay.damage)}</strong><small>{dm(d.bestDay.day)}</small></div> : null}
            {d.patrols ? <div style={{ animationDelay: '2.3s' }}><span>⭐ Megamarssit</span><strong>{d.patrols}</strong><small>kaikki terveet kävelivät samana päivänä</small></div> : null}
          </div>
        </div>
      ),
    },
    ...(d.own ? [{
      ms: 6500,
      el: (
        <div className="ms-slide">
          <span className="ms-kicker">Sinun kautesi</span>
          <div className="ms-huge display ms-counter"><Counter to={d.own.damage} /></div>
          <p>voimaa · sija {d.own.rank}/{d.own.of}</p>
          <div className="ms-own">
            <div><strong>{d.own.trainings}</strong><span>treeniä</span></div>
            <div><strong>{d.own.kept}/{d.own.closed}</strong><span>lupausta</span></div>
            <div><strong>{d.own.badges.length}</strong><span>merkkiä</span></div>
          </div>
          {d.own.best ? <p className="ms-small">Paras iskusi: {d.own.best}</p> : null}
          {d.own.badges.length ? <p className="ms-badges">{d.own.badges.join(' ')}</p> : null}
        </div>
      ),
    }] : []),
    {
      ms: 6500,
      el: (
        <div className="ms-slide ms-boss">
          <svg className="ms-boss-shadow" viewBox="0 0 390 300" aria-hidden="true">
            <path d="M70 300 C80 215 125 170 158 156 C140 120 126 76 104 30 C146 60 166 100 176 138 C186 134 204 134 214 138 C224 100 244 60 286 30 C264 76 250 120 232 156 C265 170 310 215 320 300 Z" fill="#050303" />
            <ellipse cx="180" cy="176" rx="9" ry="3.5" fill="#ff4a2e" />
            <ellipse cx="210" cy="176" rx="9" ry="3.5" fill="#ff4a2e" />
          </svg>
          <span className="ms-kicker">Loppupomo odottaa</span>
          <h2 className="display">{d.daysLeft} päivää jäljellä</h2>
          <p>Ensi-isku on jo valmiina:</p>
          <div className="ms-huge display ms-counter ms-pot">⚔️ <Counter to={d.pot} /></div>
          <button type="button" className="btn" onClick={(e) => { e.stopPropagation(); close(); }}>Katso koko raportti</button>
        </div>
      ),
    },
  ];

  const last = slides.length - 1;
  useEffect(() => {
    if (!open || paused || i >= last) return;
    const t = window.setTimeout(() => setI((x) => Math.min(last, x + 1)), slides[i].ms);
    return () => clearTimeout(t);
  }, [open, paused, i, last]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setI((x) => Math.min(last, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; };
  }, [open, last, close]);

  // Napautus vasemmalle kolmannekselle = edellinen, muualle = seuraava. Pitkä painallus vain pysäyttää.
  const tap = (e: React.PointerEvent<HTMLDivElement>) => {
    setPaused(false);
    if (Date.now() - holdAt.current > 350) return;
    const left = e.clientX < window.innerWidth / 3;
    setI((x) => (left ? Math.max(0, x - 1) : Math.min(last, x + 1)));
  };

  if (!open) {
    return <button type="button" className="btn" onClick={() => { setI(0); setOpen(true); }}>▶ Katso puolivälin tarina</button>;
  }
  // Portaali bodyyn: koko ruudun kerros ei riipu sivun asettelusta (alapalkin yläpuolella).
  return createPortal(
    <div className="ms-story" role="dialog" aria-label="Puolivälin tarina"
      onPointerDown={() => { holdAt.current = Date.now(); setPaused(true); }} onPointerUp={tap} onPointerCancel={() => setPaused(false)}>
      <div className="ms-progress">
        {slides.map((s, n) => (
          <span key={n}><i className={n < i ? 'done' : n === i ? 'now' : ''} style={n === i ? { animationDuration: `${s.ms}ms`, animationPlayState: paused || i === last ? 'paused' : 'running' } : undefined} /></span>
        ))}
      </div>
      <button type="button" className="ms-close" aria-label="Sulje" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={close}>✕</button>
      <div key={i} className="ms-stage">{slides[i].el}</div>
    </div>,
    document.body,
  );
}
