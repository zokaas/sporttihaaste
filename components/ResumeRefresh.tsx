'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Vähintään näin kauan taustalla ollut sovellus haetaan palatessa tuoreena. */
const STALE_MS = 15_000;

/**
 * Kotinäytön sovellus (iPhone) ei lataa sivua uudelleen, kun se tuodaan taustalta: näkymä jäisi vanhaksi.
 * Kun sovellus palaa näkyviin tauon jälkeen, sivun tiedot haetaan uudelleen (vieritys säilyy).
 */
export default function ResumeRefresh() {
  const router = useRouter();
  useEffect(() => {
    let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt >= STALE_MS) router.refresh();
      hiddenAt = 0;
    };
    // Safari voi palauttaa koko sivun välimuistista (bfcache): silloin haetaan aina tuoreet tiedot.
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) router.refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [router]);
  return null;
}
