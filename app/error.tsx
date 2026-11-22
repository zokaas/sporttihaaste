'use client';
import { startTransition, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendClientError } from '@/components/ErrorReporter';

const RETRY_KEY = 'mj_error_retry';

/**
 * Sivun kaatuessa: ensin yksi automaattinen uusi yritys (esim. aamulla vanhentunut kirjautuminen uusiutuu
 * seuraavalla pyynnöllä), ja vasta sitten ystävällinen viesti, uusi yritys -nappi ja ilmoitus ylläpidolle.
 */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(true);
  const retry = () => startTransition(() => { router.refresh(); reset(); });

  useEffect(() => {
    let last = 0;
    try { last = Number(sessionStorage.getItem(RETRY_KEY) ?? 0); } catch { /* ei tallennusta */ }
    // Automaattinen uusinta kerran puolessa minuutissa: jos sekin kaatuu, virhe näytetään ja raportoidaan.
    if (Date.now() - last > 30_000) {
      try { sessionStorage.setItem(RETRY_KEY, String(Date.now())); } catch { /* ei tallennusta */ }
      const t = window.setTimeout(retry, 800);
      return () => window.clearTimeout(t);
    }
    setRetrying(false);
    sendClientError(error.message || 'Sivu kaatui', `${error.digest ? `digest ${error.digest}\n` : ''}uusinta ei auttanut\n${error.stack ?? ''}`);
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  if (retrying) return <p className="muted" role="status" style={{ textAlign: 'center' }}>Ladataan…</p>;
  return (
    <section className="card">
      <h1 className="display">Jokin meni pieleen</h1>
      <p style={{ margin: 0 }}>Sivua ei voitu näyttää. Ylläpito sai tiedon virheestä. Kokeile uudelleen hetken päästä.</p>
      <button type="button" className="btn" onClick={retry}>Yritä uudelleen</button>
      <a className="btn btn-ghost" href="/">Etusivulle</a>
    </section>
  );
}
