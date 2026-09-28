'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toggleStep } from '@/app/actions';
import { STEP_GOAL } from '@/lib/rules';

/** Tämän päivän askelkuittaus yhdellä napautuksella. */
export default function QuickStep({ day, stepped }: { day: string; stepped: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function toggle() {
    setBusy(true);
    setError('');
    const res = await toggleStep(day, !stepped);
    setBusy(false);
    if (!res.ok) setError(res.error);
    router.refresh();
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button type="button" className={`btn ${stepped ? 'btn-ghost' : 'btn-moss'}`} disabled={busy} onClick={toggle}>
        {stepped ? '✓ Tämän päivän askeleet kuitattu (+50)' : `👣 Kuittaa tänään ${STEP_GOAL.toLocaleString('fi-FI')} askelta`}
      </button>
      {error ? <span className="error small">{error}</span> : null}
    </div>
  );
}
