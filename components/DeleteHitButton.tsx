'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteHit } from '@/app/kirjaa/actions';

export default function DeleteHitButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function remove() {
    if (!confirm('Poistetaanko isku?')) return;
    setBusy(true);
    const res = await deleteHit(id);
    setBusy(false);
    if (!res.ok) return alert(res.error);
    router.refresh();
  }
  return (
    <button type="button" className="btn btn-ghost" style={{ minHeight: 40, padding: '0 12px', fontSize: 14 }} disabled={busy} onClick={remove}>
      Poista
    </button>
  );
}
