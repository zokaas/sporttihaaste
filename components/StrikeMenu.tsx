'use client';
import { useEffect, useState } from 'react';
// @ts-expect-error react-dom-tyyppejä ei ole asennettu; createPortal on Nextin mukana.
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toggleStep } from '@/app/actions';
import { STEP_GOAL } from '@/lib/rules';

/** Alapalkin Lyö: kysyy, kirjataanko treeni vai kuitataanko tämän päivän askeleet. */
export default function StrikeMenu({ day, stepped }: { day: string | null; stepped: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  async function step() {
    if (!day) return;
    setBusy(true);
    setMsg(null);
    const res = await toggleStep(day, true);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    // Taistelunäkymään: monsteri ottaa askelten voiman vastaan animaation kera.
    setOpen(false);
    router.push('/?askel=1');
    router.refresh();
  }

  return (
    <>
      <button type="button" className="tabbar-strike" aria-haspopup="dialog" aria-expanded={open} aria-label="Lyö – kirjaa treeni tai askeleet" onClick={() => { setMsg(null); setOpen(true); }}>
        <span aria-hidden="true">⚔️</span>
        Lyö
      </button>
      {open ? createPortal(
        <div className="strike-sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="strike-sheet" role="dialog" aria-label="Mitä kirjataan?" onClick={(e) => e.stopPropagation()}>
            <strong className="display">Mitä kirjataan?</strong>
            <Link href="/kirjaa" className="btn" onClick={() => setOpen(false)}>⚔️ Treeni</Link>
            {day ? (
              <button type="button" className={`btn ${stepped ? 'btn-ghost' : 'btn-moss'}`} disabled={busy || stepped} onClick={step}>
                {stepped ? '✓ Tämän päivän askeleet on kuitattu' : `👣 Tänään ${STEP_GOAL.toLocaleString('fi-FI')} askelta`}
              </button>
            ) : null}
            {msg ? <span className={msg.ok ? 'ok' : 'error small'} role="status">{msg.text}</span> : null}
            <button type="button" className="linklike small" onClick={() => setOpen(false)}>Peru</button>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
