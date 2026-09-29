'use client';
import { useState } from 'react';
import { nudgeMissing } from '@/app/actions';

/** Muistuttaa sinetistä puuttuvia push-ilmoituksella. */
export default function NudgeButton({ count, compact = false }: { count: number; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [msg, setMsg] = useState('');
  async function nudge() {
    setState('busy');
    const res = await nudgeMissing();
    setState(res.ok ? 'done' : 'idle');
    setMsg(res.ok ? `Muistutus lähti ${res.sent ?? 0} laitteeseen.` : res.error);
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button type="button" className={`btn btn-ghost${compact ? ' btn-compact' : ''}`} disabled={state !== 'idle'} onClick={nudge} aria-label={`Muistuta puuttuvia (${count})`}>
        {state === 'done' ? '✓ Muistutettu' : state === 'busy' ? 'Lähetetään…' : compact ? '🔔 Muistuta' : `🔔 Muistuta puuttuvia (${count})`}
      </button>
      {msg ? <span className="muted small" role="status">{msg}</span> : null}
    </div>
  );
}
