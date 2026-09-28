'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import BossShadow from '@/components/BossShadow';

export default function Kirjaudu() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback` },
    });
    if (error) {
      setError('Linkin lähetys epäonnistui. Tarkista sähköpostiosoite ja yritä uudelleen.');
      setState('error');
    } else setState('sent');
  }

  return (
    <>
      <BossShadow>
        <h1 className="display" style={{ fontSize: 40, color: 'var(--light)' }}>Monsterijahti</h1>
        <p className="small" style={{ margin: 0, color: '#c9c1b4' }}>Kymmenen monsteria, yksi loppupomo ja kymmenen sankaria. Kausi 1.10.–20.12.</p>
      </BossShadow>

      {state === 'sent' ? (
        <div className="card">
          <h2 className="display">Tarkista sähköpostisi</h2>
          <p style={{ margin: 0 }}>Lähetimme kirjautumislinkin osoitteeseen {email}. Avaa linkki tällä samalla laitteella.</p>
        </div>
      ) : (
        <form className="card" onSubmit={send}>
          <label className="field">
            Sähköposti
            <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn" type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? 'Lähetetään…' : 'Lähetä kirjautumislinkki'}
          </button>
          {state === 'error' ? <p className="error" role="alert">{error}</p> : null}
        </form>
      )}
    </>
  );
}
