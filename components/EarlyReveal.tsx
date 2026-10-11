'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { localKey } from '@/lib/localKey';
import { release, requestTurn } from '@/lib/overlayQueue';

/**
 * Ennakkopaljastus koko ruudulle kerran: seuraava monsteri paljastui (su illalla), mutta herää vasta maanantaina.
 * Jonossa kaatumisruudun ja viikkoraportin jälkeen.
 */
export default function EarlyReveal({ week, boss, children }: { week: number; boss: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const key = localKey(`mj_early_${week}`);
      if (!localStorage.getItem(key)) {
        requestTurn('early', 4, () => {
          setOpen(true);
          if ('vibrate' in navigator) navigator.vibrate(boss ? [200, 100, 200, 100, 400] : [70, 130, 70, 500]);
        });
        localStorage.setItem(key, '1');
      }
    } catch {
      // Selaimen tallennus ei ole käytettävissä.
    }
  }, [week, boss]);
  useEffect(() => () => release('early'), []);
  function close() {
    setOpen(false);
    release('early');
  }
  if (!open) return null;
  return (
    <div className="modal" role="dialog" aria-label={boss ? 'Loppupomo paljastui' : 'Seuraava monsteri paljastui'}>
      <div className="modal-body card early-reveal">
        {children}
        <div className="row">
          <Link className="btn btn-ghost grow" href={`/monsteri/${week}`} onClick={close}>Tutki</Link>
          <button type="button" className="btn grow" onClick={close}>Maanantaina!</button>
        </div>
      </div>
    </div>
  );
}
