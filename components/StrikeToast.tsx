'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { StrikeSummary } from '@/lib/strike';

const fmt = (n: number) => n.toLocaleString('fi-FI');

/**
 * Pieni iskuikkuna ruudun yläreunassa: monsteri ottaa kirjauksen vastaan (HP laskee, luku lentää, repliikki)
 * ilman että sivu vierittyy mihinkään. Sulkeutuu itsestään; napautus vie taistelunäkymään.
 */
export default function StrikeToast({ strike, damage, label, onDone }: { strike: NonNullable<StrikeSummary>; damage: number; label: string; onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hit' | 'out'>('in');
  // Sulkemisfunktio viitteenä, jotta sivun päivittyminen taustalla ei käynnistä ajastimia uudelleen.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = [
      window.setTimeout(() => setPhase('hit'), 350),
      window.setTimeout(() => setPhase('out'), 4200),
      window.setTimeout(() => done.current(), 4600),
    ];
    if ('vibrate' in navigator) navigator.vibrate([60, 40, 120]);
    return () => t.forEach(clearTimeout);
  }, []);
  const before = Math.min(strike.maxHp, strike.hp + damage);
  const pct = (n: number) => Math.max(0, Math.min(100, (n / strike.maxHp) * 100));
  return (
    <Link href="/" className={`strike-toast is-${phase}`} role="status" aria-live="polite" onClick={onDone}>
      <div className="strike-toast-img">
        {strike.image ? <img src={strike.image} alt="" /> : <span aria-hidden="true">👹</span>}
        {phase !== 'in' ? <b className="strike-toast-dmg">−{fmt(damage)}</b> : null}
      </div>
      <div className="strike-toast-body">
        <span className="strike-toast-label">{label}</span>
        <strong>{strike.name}</strong>
        <div className="hpbar"><span style={{ width: `${pct(phase === 'in' ? before : strike.hp)}%` }} /></div>
        <span className="muted small">{fmt(strike.hp)} / {fmt(strike.maxHp)} HP</span>
        {phase !== 'in' ? <em className="strike-toast-reply">”{strike.reaction}”</em> : null}
      </div>
    </Link>
  );
}
