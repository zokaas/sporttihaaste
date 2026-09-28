'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const key = (path: string) => `mj_scroll_${path}`;

/**
 * Muistaa jokaisen sivun vierityskohdan (selaimen välilehden ajan) ja palaa siihen, kun sivulle tullaan uudelleen,
 * sen sijaan että sivu hyppäisi aina yläreunaan. Juuri kirjatun iskun jälkeen (?isku=) näytetään monsteri ylhäältä.
 */
export default function ScrollMemory() {
  const path = usePathname();

  useEffect(() => {
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(key(path)) ?? 0); } catch { /* ei tallennusta */ }
    const skip = new URLSearchParams(window.location.search).has('isku') || window.location.hash;

    // Palautus: yritetään muutaman ruudun ajan, koska sisältö voi vielä latautua. Käyttäjän oma vieritys keskeyttää.
    let frame = 0;
    let tries = 0;
    let userMoved = false;
    const stop = () => { userMoved = true; };
    const restore = () => {
      if (userMoved || tries++ > 90) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= saved - 4) { window.scrollTo(0, saved); return; }
      frame = requestAnimationFrame(restore);
    };
    if (saved > 0 && !skip) {
      window.addEventListener('touchstart', stop, { once: true, passive: true });
      window.addEventListener('wheel', stop, { once: true, passive: true });
      frame = requestAnimationFrame(restore);
    }

    // Tallennus vierittäessä (kevyesti, kerran ruudussa).
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        try { sessionStorage.setItem(key(path), String(Math.round(window.scrollY))); } catch { /* ei tallennusta */ }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('wheel', stop);
    };
  }, [path]);

  return null;
}
