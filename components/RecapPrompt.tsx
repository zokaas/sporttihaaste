'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { localKey } from '@/lib/localKey';

/** Näyttää edellisen viikon yhteenvedon kerran, kun sovellus avataan uudella viikolla. */
export default function RecapPrompt({ week, children }: { week: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const key = localKey(`mj_recap_${week}`);
      if (!localStorage.getItem(key)) {
        // Monsterin paljastus odottaa, kunnes yhteenveto suljetaan.
        (window as unknown as { __mjModalOpen?: boolean }).__mjModalOpen = true;
        setOpen(true);
        localStorage.setItem(key, '1');
      }
    } catch {
      // Selaimen tallennus ei ole käytettävissä.
    }
  }, [week]);
  function close() {
    setOpen(false);
    (window as unknown as { __mjModalOpen?: boolean }).__mjModalOpen = false;
    window.dispatchEvent(new Event('mj:modal-closed'));
  }
  if (!open) return null;
  return (
    <div className="modal" role="dialog" aria-label={`Viikon ${week} yhteenveto`}>
      <div className="modal-body card">
        {children}
        <div className="row">
          <Link className="btn btn-ghost grow" href={`/raportti/${week}`}>Jaa raportti</Link>
          <button type="button" className="btn grow" onClick={close}>Taisteluun!</button>
        </div>
      </div>
    </div>
  );
}
