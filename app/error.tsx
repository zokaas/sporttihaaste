'use client';
import { useEffect } from 'react';
import { sendClientError } from '@/components/ErrorReporter';

/** Sivun kaatuessa: ystävällinen viesti, uusi yritys ja ilmoitus ylläpidolle. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    sendClientError(error.message || 'Sivu kaatui', `${error.digest ? `digest ${error.digest}\n` : ''}${error.stack ?? ''}`);
  }, [error]);
  return (
    <section className="card">
      <h1 className="display">Jokin meni pieleen</h1>
      <p style={{ margin: 0 }}>Sivua ei voitu näyttää. Ylläpito sai tiedon virheestä. Kokeile uudelleen hetken päästä.</p>
      <button type="button" className="btn" onClick={() => reset()}>Yritä uudelleen</button>
      <a className="btn btn-ghost" href="/">Etusivulle</a>
    </section>
  );
}
