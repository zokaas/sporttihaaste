'use client';
import { useEffect } from 'react';
import { sendClientError } from '@/components/ErrorReporter';

/** Koko sovelluksen kaatuessa (myös ulkoasu): pelkistetty sivu omalla tyylillä. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    sendClientError(error.message || 'Sovellus kaatui', `${error.digest ? `digest ${error.digest}\n` : ''}${error.stack ?? ''}`);
  }, [error]);
  return (
    <html lang="fi">
      <body style={{ background: '#0E0C0B', color: '#f2eae0', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
        <h1>Jokin meni pieleen</h1>
        <p>Sovellusta ei voitu näyttää. Ylläpito sai tiedon virheestä.</p>
        <button type="button" onClick={() => reset()} style={{ padding: '12px 18px', borderRadius: 12, border: 0, background: '#b3261e', color: '#fff', fontSize: 16 }}>Yritä uudelleen</button>
      </body>
    </html>
  );
}
