'use client';
import { useEffect, useState } from 'react';

/** Yöllinen vierailu: klo 00–04 Suomen aikaa ruutu tummuu, sumu leijuu ja varjossa näkyy hetken silmäpari. Ei joka kerta. */
export default function NightVisit() {
  const [on, setOn] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hour = Number(new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    if (hour > 3) return;
    try {
      if (sessionStorage.getItem('mj_night')) return;
      sessionStorage.setItem('mj_night', '1');
    } catch { /* ei tallennusta */ }
    if (Math.random() > 0.5) return;
    const start = window.setTimeout(() => setOn({ left: Math.random() < 0.5 ? 12 : 72, top: 25 + Math.random() * 40 }), 1500 + Math.random() * 4000);
    const end = window.setTimeout(() => setOn(null), 12000);
    return () => { clearTimeout(start); clearTimeout(end); };
  }, []);
  if (!on) return null;
  return (
    <div className="night-visit" aria-hidden="true">
      <div className="night-fog" />
      <div className="night-eyes" style={{ left: `${on.left}%`, top: `${on.top}%` }}><i /><i /></div>
    </div>
  );
}
