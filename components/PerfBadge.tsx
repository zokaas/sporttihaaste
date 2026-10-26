'use client';
import { useEffect, useState } from 'react';
import type { ServerTiming } from '@/lib/timing';

const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(n)} ms`);

/** Ylläpitäjän nopeusmittari: palvelimen ja selaimen ajat, jotta hitauden syy näkyy. */
export default function PerfBadge({ server }: { server: ServerTiming }) {
  const [nav, setNav] = useState<{ ttfb: number; ready: number } | null>(null);
  useEffect(() => {
    const read = () => {
      const e = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (e && e.domContentLoadedEventEnd > 0) setNav({ ttfb: e.responseStart - e.startTime, ready: e.domContentLoadedEventEnd - e.startTime });
    };
    read();
    const t = window.setTimeout(read, 1500);
    return () => clearTimeout(t);
  }, []);
  return (
    <p className="muted small" style={{ margin: 0, textAlign: 'center' }}>
      ⏱ Palvelin {ms(server.totalMs)} (tietokanta {ms(server.queriesMs)}, laskenta {ms(server.computeMs)})
      {server.cold ? ' · 🧊 kylmäkäynnistys' : ` · lämmin (${server.uptimeS} s)`}
      {nav ? ` · selain: ensimmäinen tavu ${ms(nav.ttfb)}, sivu valmis ${ms(nav.ready)}` : ''}
    </p>
  );
}
