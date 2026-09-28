'use client';
import { useEffect, useState } from 'react';

/**
 * Ohjeteksti, jonka voi sulkea ×-napista. Suljettu ohje muistetaan tässä selaimessa,
 * ja sen saa takaisin pienestä ⓘ-napista. Kun `title` on annettu, ⓘ ja × istuvat otsikon
 * vieressä, joten suljettu ohje ei vie omaa riviä.
 */
export default function Hint({ id, children, title, className = 'muted small' }: { id: string; children: React.ReactNode; title?: React.ReactNode; className?: string }) {
  const key = `mj_hint_${id}`;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try { if (localStorage.getItem(key) === 'closed') setOpen(false); } catch { /* ei tallennusta */ }
  }, [key]);

  const toggle = (next: boolean) => {
    setOpen(next);
    try { if (next) localStorage.removeItem(key); else localStorage.setItem(key, 'closed'); } catch { /* ei tallennusta */ }
  };
  const button = open
    ? <button type="button" className="hint-close" onClick={() => toggle(false)} aria-label="Piilota ohje">×</button>
    : <button type="button" className="hint-open" onClick={() => toggle(true)} aria-label="Näytä ohje">ⓘ</button>;

  if (title) {
    return (
      <div className="hint-block">
        <div className="hint-title">{title}{button}</div>
        {open ? <div className={className}>{children}</div> : null}
      </div>
    );
  }
  if (!open) return <div className="hint-closed">{button}</div>;
  return (
    <div className={`hint ${className}`}>
      <div className="hint-text">{children}</div>
      {button}
    </div>
  );
}
