'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const key = (path: string) => `mj_scroll_${path}`;
const save = (path: string, y: number) => { try { sessionStorage.setItem(key(path), String(Math.round(y))); } catch { /* ei tallennusta */ } };

/**
 * Muistaa jokaisen sivun vierityskohdan (selaimen välilehden ajan) ja palaa siihen, kun sivulle tullaan uudelleen,
 * sen sijaan että sivu hyppäisi aina yläreunaan. Juuri kirjatun iskun jälkeen (?isku=) näytetään monsteri ylhäältä.
 *
 * Kohta tallennetaan linkkiä napautettaessa, ei sivunvaihdon aikana: silloin latausruutu lyhentää sivua ja selain
 * siirtää vierityksen ylös, mikä muuten tallentuisi väärin.
 */
export default function ScrollMemory() {
  const path = usePathname();

  useEffect(() => {
    let navigating = false;

    // Linkin napautus (myös alapalkki ja Lyö-valikko): tallenna nykyinen kohta heti ja lopeta tallentaminen.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.origin !== window.location.origin) return;
      save(path, window.scrollY);
      if (a.pathname !== path) navigating = true;
    };
    const onPop = () => { navigating = true; };
    const onHide = () => { if (!navigating) save(path, window.scrollY); };

    // Tavallinen vieritys tallennetaan kevyesti (kerran ruudussa), paitsi sivunvaihdon aikana.
    let pending = false;
    const onScroll = () => {
      if (pending || navigating) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (!navigating) save(path, window.scrollY);
      });
    };

    // Palautus: odotetaan, että sivu on tarpeeksi pitkä (sisältö voi vielä latautua). Oma kosketus keskeyttää.
    let saved = 0;
    try { saved = Number(sessionStorage.getItem(key(path)) ?? 0); } catch { /* ei tallennusta */ }
    const skip = new URLSearchParams(window.location.search).has('isku') || Boolean(window.location.hash);
    let frame = 0;
    let userMoved = false;
    const started = performance.now();
    const stop = () => { userMoved = true; };
    const restore = () => {
      if (userMoved || performance.now() - started > 4000) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max >= saved - 4) {
        window.scrollTo(0, saved);
        // Varmistus seuraavalla ruudulla, jos Next ehti vielä vierittää ylös.
        frame = requestAnimationFrame(() => { if (!userMoved && Math.abs(window.scrollY - saved) > 4) window.scrollTo(0, saved); });
        return;
      }
      frame = requestAnimationFrame(restore);
    };
    if (saved > 0 && !skip) {
      window.addEventListener('touchstart', stop, { once: true, passive: true });
      window.addEventListener('wheel', stop, { once: true, passive: true });
      frame = requestAnimationFrame(restore);
    }

    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('wheel', stop);
    };
  }, [path]);

  return null;
}
