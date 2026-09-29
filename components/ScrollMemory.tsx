'use client';
import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const key = (path: string) => `mj_scroll_${path}`;
// Taistelunäkymä avautuu ylhäältä, jos siellä ei ole käyty hetkeen: tilanne on ehtinyt muuttua.
const EXPIRES: Record<string, number> = { '/': 10 * 60_000 };
const load = (path: string) => {
  try {
    const [y, at] = (sessionStorage.getItem(key(path)) ?? '0').split('|').map(Number);
    return EXPIRES[path] && at && Date.now() - at > EXPIRES[path] ? 0 : y || 0;
  } catch { return 0; }
};
const save = (path: string, y: number) => { try { sessionStorage.setItem(key(path), `${Math.round(y)}|${Date.now()}`); } catch { /* ei tallennusta */ } };

/**
 * Jokainen sivu muistaa vierityskohtansa (selaimen välilehden ajan), kuten sovelluksen välilehdet:
 * sivulle palatessa se on heti samassa kohdassa, ei ylhäällä eikä hyppien. Uusi sivu avautuu ylhäältä.
 *
 * - Palautus tehdään ennen kuin ruutu piirretään (useLayoutEffect), joten hyppyä ei näy.
 * - Jos sisältö on vielä latautumassa, odotetaan enintään hetki; oma kosketus keskeyttää odotuksen.
 * - Kohta tallennetaan vasta, kun vieritys pysähtyy, ja linkkiä napautettaessa: ei jokaisella ruudulla.
 * - Juuri kirjatun treenin jälkeen (?isku=) taistelunäkymä avautuu ylhäältä, jotta isku näkyy.
 * - Taistelunäkymä avautuu ylhäältä myös, jos siellä ei ole käyty yli 10 minuuttiin.
 * - Jo avoimen välilehden napautus liu'uttaa sivun alkuun (kuten puhelinsovelluksissa).
 */
export default function ScrollMemory() {
  const path = usePathname();

  useLayoutEffect(() => {
    const fresh = new URLSearchParams(window.location.search).has('isku');
    if (window.location.hash) return;
    const target = fresh ? 0 : load(path);
    const fits = () => document.documentElement.scrollHeight - window.innerHeight >= target - 4;
    if (fits()) { window.scrollTo(0, target); return; }

    // Sisältö ei vielä riitä (latausruutu): odotetaan lyhyesti ja palautetaan, ellei käyttäjä ehdi koskea.
    let frame = 0;
    let moved = false;
    const stop = () => { moved = true; };
    const started = performance.now();
    const retry = () => {
      if (moved || performance.now() - started > 1200) return;
      if (fits()) { window.scrollTo(0, target); return; }
      frame = requestAnimationFrame(retry);
    };
    window.addEventListener('touchstart', stop, { once: true, passive: true });
    window.addEventListener('wheel', stop, { once: true, passive: true });
    frame = requestAnimationFrame(retry);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('wheel', stop);
    };
  }, [path]);

  useEffect(() => {
    let navigating = false;
    let timer = 0;
    const onScroll = () => {
      if (navigating) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (!navigating) save(path, window.scrollY); }, 150);
    };
    // Linkin napautus: nykyinen kohta talteen heti, ja sivunvaihdon aikaisia vierityksiä ei tallenneta.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.origin !== window.location.origin) return;
      if (a.pathname === path && a.closest('.tabbar')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      save(path, window.scrollY);
      if (a.pathname !== path) navigating = true;
    };
    const onPop = () => { navigating = true; };
    const onHide = () => { if (!navigating) save(path, window.scrollY); };
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('pagehide', onHide);
    };
  }, [path]);

  return null;
}
