'use client';
import { useEffect, useState } from 'react';

/**
 * Ohjeteksti, jonka voi sulkea ×-napista. Suljettu ohje muistetaan tässä selaimessa,
 * ja sen saa takaisin pienestä ⓘ-napista.
 */
export default function Hint({ id, children, className = 'muted small' }: { id: string; children: React.ReactNode; className?: string }) {
  const key = `mj_hint_${id}`;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try { if (localStorage.getItem(key) === 'closed') setOpen(false); } catch { /* ei tallennusta */ }
  }, [key]);

  const toggle = (next: boolean) => {
    setOpen(next);
    try { if (next) localStorage.removeItem(key); else localStorage.setItem(key, 'closed'); } catch { /* ei tallennusta */ }
  };

  if (!open) {
    return <button type="button" className="hint-open" onClick={() => toggle(true)} aria-label="Näytä ohje">ⓘ</button>;
  }
  return (
    <div className={`hint ${className}`}>
      <div className="hint-text">{children}</div>
      <button type="button" className="hint-close" onClick={() => toggle(false)} aria-label="Piilota ohje">×</button>
    </div>
  );
}
