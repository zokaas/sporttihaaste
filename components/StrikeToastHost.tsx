'use client';
import { useEffect, useState } from 'react';
import StrikeToast from '@/components/StrikeToast';
import type { StrikeSummary } from '@/lib/strike';

export type StrikeEvent = { strike: NonNullable<StrikeSummary>; damage: number; label: string };

/** Näyttää iskuikkunan kaikkialla sovelluksessa. Asuu juuriasettelussa, joten sivun päivitys ei sulje sitä. */
export function showStrike(detail: StrikeEvent) {
  window.dispatchEvent(new CustomEvent<StrikeEvent>('mj:strike', { detail }));
}

export default function StrikeToastHost() {
  const [current, setCurrent] = useState<(StrikeEvent & { id: number }) | null>(null);
  useEffect(() => {
    const on = (e: Event) => setCurrent({ ...(e as CustomEvent<StrikeEvent>).detail, id: Date.now() });
    window.addEventListener('mj:strike', on);
    return () => window.removeEventListener('mj:strike', on);
  }, []);
  if (!current) return null;
  return <StrikeToast key={current.id} strike={current.strike} damage={current.damage} label={current.label} onDone={() => setCurrent(null)} />;
}
