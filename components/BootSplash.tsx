'use client';
import { useEffect, useState } from 'react';

/**
 * Käynnistysruutu: sama kuva kuin iPhonen käynnistyskuvassa (silmät + nimi), joten siirtymä
 * kotinäytöltä sovellukseen ei välähdä. Näkyy vain sovelluksen ensimmäisellä latauksella ja häivytetään,
 * kun sivun sisältö on valmis (latausnäkymä on poistunut). Sivujen välillä liikuttaessa sitä ei näytetä.
 */
export default function BootSplash() {
  const [state, setState] = useState<'on' | 'fading' | 'off'>('on');
  useEffect(() => {
    const ready = () => !document.querySelector('.loading-stage') && Boolean(document.querySelector('main.app')?.childElementCount);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(cap);
      setState('fading');
      window.setTimeout(() => setState('off'), 350);
    };
    const observer = new MutationObserver(() => { if (ready()) finish(); });
    const main = document.querySelector('main.app');
    if (main) observer.observe(main, { childList: true, subtree: true });
    // Varmuuden vuoksi ruutu poistuu viimeistään 6 s kuluttua.
    const cap = window.setTimeout(finish, 6000);
    if (ready()) finish();
    return () => { observer.disconnect(); clearTimeout(cap); };
  }, []);
  if (state === 'off') return null;
  return (
    <div className={`boot-splash${state === 'fading' ? ' is-fading' : ''}`} aria-hidden="true">
      <div className="boot-eyes"><span /><span /></div>
      <div className="boot-title">Monsterijahti</div>
    </div>
  );
}
