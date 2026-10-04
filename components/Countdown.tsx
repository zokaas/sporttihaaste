'use client';
import { useEffect, useState } from 'react';

/** Aikaa viikon loppuun (tai muuhun hetkeen). offsetMs siirtää "nyt"-hetkeä (testitila). */
export default function Countdown({ endMs, offsetMs = 0, title = 'Aikaa siihen, kun uusi monsteri paljastuu (kirjaukset auki ma klo 12 asti)', done = 'Viikko päättyi', suffix = 'jäljellä' }: { endMs: number; offsetMs?: number; title?: string; done?: string; suffix?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offsetMs);
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [offsetMs]);
  if (now === null) return <span>&nbsp;</span>;
  const left = Math.max(0, endMs - now);
  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const urgent = left < 24 * 3_600_000;
  return (
    <span className={urgent ? 'countdown urgent' : 'countdown'} title={title}>
      ⏳ {left === 0 ? done : d > 0 ? `${d} pv ${h} h ${suffix}` : `${h} h ${m} min ${suffix}`}
    </span>
  );
}
