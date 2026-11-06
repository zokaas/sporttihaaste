'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { localKey } from '@/lib/localKey';
import { heartbeat, riser, setDread, startSound, stopHeartbeat, stopSound, thud } from '@/lib/storySound';
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
  /** Katsojan oma id: oma rivi korostetaan voimakisassa. */
  me: string | null;
  fallen: { week: number; name: string; image: string | null; day: string; took: number; blow: string | null }[];
  race: { id: string; name: string; avatar: string | null; cum: number[] }[];
  raceWeeks: number[];
  biggest: { name: string; sport: string; minutes: number; damage: number } | null;
  together: { name: string; people: number; sport: string; damage: number } | null;
  bestDay: { day: string; damage: number } | null;
  /** Pystyssä olevat: käynnissä oleva taistelu ja rästit. */
  standing: { name: string; current: boolean }[];
  weekRows: { week: number; monster: string; killed: boolean; power: number; hero: string | null; days: number; done: boolean }[];
  own: { damage: number; rank: number; of: number; trainings: number; kept: number; closed: number; stepDays: number; best: string | null; badges: { icon: string; title: string }[] } | null;
};

const fmt = (n: number) => n.toLocaleString('fi-FI');
const dm = (iso: string) => `${Number(iso.slice(8, 10))}.${Number(iso.slice(5, 7))}.`;
const SEEN = 'mj_mid_story_seen';
const SOUND = 'mj_story_sound';
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
function Race({ race, weeks, paused, me }: { race: StoryData['race']; weeks: number[]; paused: boolean; me: string | null }) {
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
          // Viikon lisäys: ohitukset ja kirit näkyvät.
          const gain = v - (i > 0 ? r.cum[i - 1] ?? 0 : 0);
          return (
            <div key={r.id} className={`ms-race-row${r.id === me ? ' me' : ''}`} style={{ transform: `translateY(${rank * 34}px)` }}>
              <span className="ms-race-rank">{rank === 0 ? '👑' : `${rank + 1}.`}</span>
              {r.avatar ? <img src={r.avatar} alt="" /> : <b>{r.name.slice(0, 1)}</b>}
              <span className="ms-race-track"><span className="ms-race-bar" style={{ width: `${Math.max(2, (v / max) * 100)}%` }}><span>{r.name}</span></span></span>
              <span className="ms-race-num">{fmt(v)}{gain > 0 ? <small key={i}>+{fmt(gain)}</small> : null}</span>
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
/** autoOpen: avataan heti (etusivun kortista), muuten vain ensimmäisellä käynnillä. */
export default function MidseasonStory({ d, autoOpen = false }: { d: StoryData; autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const holdAt = useRef(0);

  useEffect(() => {
    if (autoOpen) return setOpen(true);
    try { if (!localStorage.getItem(localKey(SEEN))) setOpen(true); } catch { /* ei tallennusta */ }
  }, [autoOpen]);
  const close = useCallback(() => {
    setOpen(false);
    stopSound();
    try { localStorage.setItem(localKey(SEEN), '1'); } catch { /* ei tallennusta */ }
  }, []);

  // Ääni on oletuksena pois; valinta muistetaan. Selain sallii äänen vasta napautuksesta.
  const [sound, setSound] = useState(false);
  useEffect(() => { try { setSound(localStorage.getItem(localKey(SOUND)) === '1'); } catch { /* ei tallennusta */ } }, []);
  const toggleSound = () => {
    const on = !sound;
    setSound(on);
    try { localStorage.setItem(localKey(SOUND), on ? '1' : '0'); } catch { /* ei tallennusta */ }
    if (on) startSound(); else stopSound();
  };

  const slides: { id: string; ms: number; el: React.ReactNode }[] = [
    {
      id: 'intro',
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
      id: 'fallen',
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
                  <span>Kaatui {dm(f.day)}</span>
                  {f.blow ? <span className="ms-fallen-role"><small>Viimeinen isku</small>⚔️ {f.blow}</span> : null}
                  {d.weekRows.find((w) => w.week === f.week)?.hero ? <span className="ms-fallen-role hero"><small>Viikon sankari</small>🏆 {d.weekRows.find((w) => w.week === f.week)!.hero}</span> : null}
                </div>
              ))}
            </div>
          ) : <p>Yksikään ei ole vielä kaatunut. Toinen puolisko ratkaisee.</p>}
          {d.standing.map((x, n) => (
            <p key={x.name} className={`ms-standing${x.current ? '' : ' backlog'}`} style={{ animationDelay: `${0.8 + d.fallen.length * 0.6 + n * 0.3}s` }}>
              {x.current ? '⚔️ Taistelu käynnissä' : '😈 Rästissä'}: <b>{x.name}</b>
            </p>
          ))}
        </div>
      ),
    },
    {
      id: 'power',
      ms: 6000,
      el: (
        <div className="ms-slide">
          <span className="ms-kicker">Porukan voima</span>
          <div className="ms-huge display ms-counter"><Counter to={d.damage} /></div>
          <p>voimaa yhteensä · {fmt(d.trainings)} treeniä · {fmt(d.stepDays)} askelpäivää{d.patrols ? ` · ${d.patrols} megamarssia ⭐` : ''}</p>
          {(() => {
            // Vain päättyneet viikot (kesken oleva ei näytä hiipumiselta). Voima päivässä, jotta pidempi viikko 1 (portti) on reilusti vertailtavissa.
            const rows = d.weekRows.filter((w) => w.done && w.days > 0);
            if (rows.length < 2) return null;
            const perDay = rows.map((w) => Math.round(w.power / w.days));
            const top = Math.max(1, ...perDay);
            const best = perDay.indexOf(top);
            const avg = Math.round(rows.reduce((a, w) => a + w.power, 0) / rows.reduce((a, w) => a + w.days, 0));
            const now = d.weekRows.find((w) => !w.done);
            return (
              <div className="ms-pace">
                <p className="ms-pace-lead">Joka päivä porukka lyö keskimäärin <strong>{fmt(avg)}</strong> voimaa.</p>
                <p className="ms-small" style={{ margin: 0 }}>Voimaa päivässä, viikko kerrallaan</p>
                {rows.map((w, n) => (
                  <div key={w.week} className={`ms-pace-row${n === best ? ' best' : ''}`}>
                    <span>vk {w.week}</span>
                    <div className="ms-race-track"><i style={{ width: `${(perDay[n] / top) * 100}%`, animationDelay: `${0.3 + n * 0.15}s` }} /></div>
                    <b>{fmt(perDay[n])}{n === best ? ' 🏆' : ''}</b>
                  </div>
                ))}
                <strong>🏆 Paras viikko {rows[best].week}: {fmt(top)} voimaa päivässä</strong>
                {now ? <p className="ms-small" style={{ margin: 0 }}>⚔️ Viikko {now.week} käynnissä: {fmt(now.power)} voimaa jo kasassa</p> : null}
              </div>
            );
          })()}
        </div>
      ),
    },
    {
      id: 'race',
      ms: Math.max(6000, d.raceWeeks.length * RACE_STEP_MS + 2500),
      el: (
        <div className="ms-slide">
          <span className="ms-kicker">Voimakisa</span>
          <h2 className="display">Kuka löi eniten?</h2>
          <Race race={d.race} weeks={d.raceWeeks} paused={paused} me={d.me} />
        </div>
      ),
    },
    {
      id: 'high',
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
      id: 'own',
      ms: 6500,
      el: (
        <div className="ms-slide">
          <span className="ms-kicker">Sinun kautesi</span>
          <div className="ms-huge display ms-counter"><Counter to={d.own.damage} /></div>
          <p>voimaa · sija {d.own.rank}/{d.own.of}</p>
          <div className="ms-own">
            <div><strong>{d.own.trainings}</strong><span>treeniä</span></div>
            <div><strong>{d.own.kept}/{d.own.closed}</strong><span>lupausta pidetty</span></div>
            <div><strong>{d.own.stepDays}</strong><span>askelpäivää</span></div>
          </div>
          {d.own.best ? <p className="ms-small">Paras iskusi: {d.own.best}</p> : null}
          {d.own.badges.length ? (
            <div className="ms-own-badges">
              {d.own.badges.map((b, n) => <span key={n} style={{ animationDelay: `${1.2 + n * 0.2}s` }}>{b.icon} {b.title}</span>)}
            </div>
          ) : null}
        </div>
      ),
    }] : []),
    {
      id: 'boss',
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
  // Kortin äänet: humina voimistuu, ✝ tömähtää, laskurit nousevat, loppupomon sydän lyö.
  const slideId = slides[i]?.id;
  useEffect(() => {
    if (!open || !sound) return;
    startSound();
    stopHeartbeat();
    if (slideId === 'intro') setDread(1);
    if (slideId === 'fallen') { setDread(1); d.fallen.forEach((_, n) => thud(0.7 + n * 0.6)); }
    if (slideId === 'power' || slideId === 'own') { setDread(2); riser(1.8); }
    if (slideId === 'race' || slideId === 'weeks' || slideId === 'high') setDread(2);
    if (slideId === 'boss') { setDread(3); heartbeat(6); riser(1.8); }
  }, [open, sound, slideId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopSound(), []);
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
      <button type="button" className="ms-sound" aria-label={sound ? 'Ääni pois' : 'Ääni päälle'} aria-pressed={sound} onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={toggleSound}>{sound ? '🔊' : '🔇'}</button>
      <button type="button" className="ms-close" aria-label="Sulje" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={close}>✕</button>
      <div key={i} className="ms-stage">{slides[i].el}</div>
    </div>,
    document.body,
  );
}
