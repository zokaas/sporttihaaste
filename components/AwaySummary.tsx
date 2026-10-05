'use client';
import { useEffect } from 'react';
import { showStrike } from '@/components/StrikeToastHost';
import { SEEN_KEY, markSeen } from '@/components/LiveStrikes';
import type { StrikeSummary } from '@/lib/strike';
import { overlayBusy } from '@/lib/overlayQueue';

export type AwayEvent = { at: string; name: string; kind: 'hit' | 'step'; damage: number };

/**
 * Taistelunäkymään palatessa: poissaollessa tulleet muiden iskut ja askeleet koottuna yhteen
 * iskuikkunaan ("Poissaollessasi: 3 iskua ja 2 askelpäivää · Matti, Olli").
 */
export default function AwaySummary({ events, strike, skip }: { events: AwayEvent[]; strike: StrikeSummary; skip: boolean }) {
  useEffect(() => {
    let since: string | null = null;
    try { since = localStorage.getItem(SEEN_KEY); } catch { /* ei tallennusta */ }
    markSeen();
    if (!since || skip || !strike) return;
    const fresh = events.filter((e) => e.at > since!);
    if (!fresh.length) return;
    const hits = fresh.filter((e) => e.kind === 'hit').length;
    const steps = fresh.length - hits;
    const parts = [hits ? `${hits} ${hits === 1 ? 'isku' : 'iskua'}` : '', steps ? `${steps} askelpäivä${steps === 1 ? '' : 'ä'}` : ''].filter(Boolean).join(' ja ');
    const who = [...new Set(fresh.map((e) => e.name))];
    const names = who.length > 3 ? `${who.slice(0, 3).join(', ')} + ${who.length - 3}` : who.join(', ');
    // Jos kaatuminen tai viikkoraportti näytetään, poissaolon kooste jätetään pois (uutisia on jo tarpeeksi).
    const t = setTimeout(() => {
      if (overlayBusy()) return;
      showStrike({ strike, damage: fresh.reduce((a, e) => a + e.damage, 0), label: 'Poissaollessasi', detail: `${parts} · ${names}` });
    }, 50);
    return () => clearTimeout(t);
    // Näytetään kerran per käynti: riippuvuudet tarkoituksella tyhjät.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
