'use client';
import { useEffect, useState } from 'react';

type Prompt = Event & { prompt: () => Promise<void> };

/**
 * Ohje sovelluksen lisäämisestä kotinäytölle, kun sovellusta käytetään selaimessa.
 * iPhonessa push-ilmoitukset toimivat vain kotinäytöltä avattuna. Suljettu ohje muistetaan.
 */
export default function InstallHint() {
  const [kind, setKind] = useState<'ios' | 'android' | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  useEffect(() => {
    try { if (localStorage.getItem('mj_install_hint') === 'closed') return; } catch { /* ei tallennusta */ }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) setKind('ios');
    else if (/Android/.test(ua)) setKind('android');
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as Prompt); setKind('android'); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!kind) return null;
  const close = () => {
    setKind(null);
    try { localStorage.setItem('mj_install_hint', 'closed'); } catch { /* ei tallennusta */ }
  };
  return (
    <div className="install-hint" role="note">
      <span aria-hidden="true" style={{ fontSize: 22 }}>📲</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <strong>Lisää Monsterijahti kotinäytölle</strong>
        {kind === 'ios' ? (
          <p className="small" style={{ margin: 0 }}>Napauta Safarin <strong>Jaa</strong>-kuvaketta ⬆︎ ja valitse <strong>Lisää Koti-valikkoon</strong>. Avaa sovellus sen jälkeen kotinäytöltä: vain silloin ilmoitukset toimivat iPhonessa.</p>
        ) : prompt ? (
          <button type="button" className="btn" style={{ minHeight: 40, marginTop: 6 }} onClick={async () => { await prompt.prompt(); close(); }}>Asenna sovellus</button>
        ) : (
          <p className="small" style={{ margin: 0 }}>Avaa selaimen valikko <strong>⋮</strong> ja valitse <strong>Lisää aloitusnäyttöön</strong>.</p>
        )}
      </div>
      <button type="button" className="hint-close" onClick={close} aria-label="Sulje ohje">×</button>
    </div>
  );
}
