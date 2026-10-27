'use client';
import { useEffect, useState } from 'react';
import { writeTarget } from '@/lib/target';
import TargetChoice, { type TargetPart } from '@/components/TargetChoice';
// @ts-expect-error react-dom-tyyppejä ei ole asennettu; createPortal on Nextin mukana.
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { stepTargets, toggleStep } from '@/app/actions';
import { STEP_GOAL } from '@/lib/rules';
import { goStrike, stepStrikeQuery } from '@/lib/goStrike';

/** Alapalkin Lyö: kysyy, kirjataanko treeni vai kuitataanko tämän päivän askeleet. */
export default function StrikeMenu({ day, stepped }: { day: string | null; stepped: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Kohteen valinta: osat haetaan, kun valikko avataan; askeleet kysyvät, ketä lyödään.
  const [targets, setTargets] = useState<TargetPart[] | null | undefined>(undefined);
  const [aim, setAim] = useState(false);
  useEffect(() => {
    if (!open || !day || stepped) return;
    let live = true;
    stepTargets().then((t) => { if (live) setTargets(t); }).catch(() => { if (live) setTargets(null); });
    return () => { live = false; };
  }, [open, day, stepped]);
  const choose = Boolean(targets?.some((t) => !t.dead));
  // Nappia voi painaa heti: jos osat ovat vielä tulossa, odotetaan ne ja kuitataan sitten (tai kysytään kohde).
  useEffect(() => {
    if (aim && targets !== undefined && !choose && !busy) void step();
  }, [aim, targets]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  async function step(target: number | null = null) {
    if (!day) return;
    setBusy(true);
    setMsg(null);
    const res = await toggleStep(day, true, false, target);
    setBusy(false);
    if (!res.ok) { setAim(false); return setMsg({ ok: false, text: res.error }); }
    // Etusivun alkuun: monsteri ottaa askeleet vastaan näyttämöllä.
    setOpen(false);
    setAim(false);
    goStrike(router, stepStrikeQuery(target));
  }

  return (
    <>
      <button type="button" className="tabbar-strike" aria-haspopup="dialog" aria-expanded={open} aria-label="Lyö – kirjaa treeni tai askeleet" onClick={() => { setMsg(null); setAim(false); setOpen(true); }}>
        <span aria-hidden="true">⚔️</span>
        Lyö
      </button>
      {open ? createPortal(
        <div className="strike-sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="strike-sheet" role="dialog" aria-label="Mitä kirjataan?" onClick={(e) => e.stopPropagation()}>
            <strong className="display">Mitä kirjataan?</strong>
            <Link href="/kirjaa" className="btn" onClick={() => setOpen(false)}>⚔️ Treeni</Link>
            {day ? (
              <button type="button" className={`btn ${stepped ? 'btn-ghost' : 'btn-moss'}`} disabled={busy || stepped || aim} onClick={() => (targets === undefined || choose ? setAim(true) : step())}>
                {stepped ? '✓ Tämän päivän askeleet on kuitattu' : busy ? 'Kuitataan…' : `👣 Tänään ${STEP_GOAL.toLocaleString('fi-FI')} askelta`}
              </button>
            ) : null}
            {aim && targets === undefined ? <span className="muted small" role="status">Haetaan monsteria…</span> : null}
            {aim && targets && choose ? (
              <>
                <strong>Ketä lyöt askeleilla?</strong>
                <TargetChoice targets={targets} selected={null} disabled={busy} onPick={(i) => { writeTarget(i); step(i); }} />
              </>
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
