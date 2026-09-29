'use client';
import { useEffect, useState } from 'react';
import StrikeToast from '@/components/StrikeToast';
import type { StrikeSummary } from '@/lib/strike';

export type StrikeEvent = { strike: NonNullable<StrikeSummary>; damage: number; label: string; detail?: string };

/** Näyttää iskuikkunan kaikkialla sovelluksessa. Asuu juuriasettelussa, joten sivun päivitys ei sulje sitä. */
export function showStrike(detail: StrikeEvent) {
  window.dispatchEvent(new CustomEvent<StrikeEvent>('mj:strike', { detail }));
}

/** Iskuikkunat näytetään jonossa yksi kerrallaan (esim. kaksi kaveria lyö peräkkäin). */
export default function StrikeToastHost() {
  const [queue, setQueue] = useState<(StrikeEvent & { id: number })[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => setQueue((q) => [...q, { ...(e as CustomEvent<StrikeEvent>).detail, id: Date.now() + n++ }].slice(-4));
    window.addEventListener('mj:strike', on);
    return () => window.removeEventListener('mj:strike', on);
  }, []);
  const current = queue[0];
  if (!current) return null;
  return <StrikeToast key={current.id} strike={current.strike} damage={current.damage} label={current.label} detail={current.detail} onDone={() => setQueue((q) => q.slice(1))} />;
}
