'use client';
import { useEffect, useState } from 'react';

type State = 'checking' | 'off' | 'on' | 'denied' | 'unsupported' | 'needs-home-screen';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function saveSubscription(sub: PushSubscription) {
  const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Palvelin vastasi ${res.status}`);
}

/**
 * Ilmoitusten tila ja päälle kytkentä. Tarkistaa, että tilaus on oikeasti olemassa ja tallessa palvelimella.
 * card: näytetään omana korttinaan vain, kun ilmoitukset puuttuvat (ei silloin, kun ne ovat jo päällä).
 */
export default function PushToggle({ card = false }: { card?: boolean }) {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        return setState(ios && !standalone ? 'needs-home-screen' : 'unsupported');
      }
      if (Notification.permission === 'denied') return setState('denied');
      if (Notification.permission !== 'granted') return setState('off');
      // Lupa on annettu, mutta tilaus voi silti puuttua tai olla tallentamatta.
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return setState('off');
        await saveSubscription(sub);
        setState('on');
      } catch {
        setState('off');
      }
    })();
  }, []);

  async function enable() {
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY puuttuu Vercelistä.');
      const reg = await navigator.serviceWorker.ready;
      const options = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) };
      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe(options);
      } catch {
        // Vanha tilaus eri avaimella estää uuden. Poistetaan se ja yritetään kerran uudelleen.
        await (await reg.pushManager.getSubscription())?.unsubscribe();
        sub = await reg.pushManager.subscribe(options);
      }
      await saveSubscription(sub);
      setState('on');
    } catch (e) {
      setError(`Ilmoitusten käyttöönotto epäonnistui: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (card && (state === 'checking' || state === 'on')) return null;
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {state === 'checking' ? <p className="muted" style={{ margin: 0 }}>Tarkistetaan ilmoituksia…</p> : null}
      {state === 'on' ? <p className="ok" style={{ margin: 0 }}>✓ Ilmoitukset ovat päällä tässä laitteessa.</p> : null}
      {state === 'denied' ? <p className="error" style={{ margin: 0 }}>Ilmoitukset on estetty. Salli ne puhelimen asetuksista (Asetukset → Ilmoitukset → Monsterijahti) ja avaa sovellus uudelleen.</p> : null}
      {state === 'needs-home-screen' ? <p className="note" style={{ margin: 0 }}>iPhonessa ilmoitukset toimivat vain, kun sovellus on lisätty Koti-valikkoon ja avattu sieltä.</p> : null}
      {state === 'unsupported' ? <p className="note" style={{ margin: 0 }}>Tämä selain ei tue ilmoituksia. Kokeile Chromea (Android) tai Safaria kotinäytöltä (iPhone).</p> : null}
      {state === 'off' ? (
        <button className="btn btn-moss" type="button" disabled={busy} onClick={enable}>{busy ? 'Hetki…' : 'Laita ilmoitukset päälle'}</button>
      ) : null}
      {error ? <p className="error" role="alert" style={{ margin: 0 }}>{error}</p> : null}
    </div>
  );
  return card ? <section className="card"><h2 className="display">Ilmoitukset</h2>{body}</section> : body;
}
