'use client';
import { useRouter } from 'next/navigation';
import { deleteMessage } from '@/app/actions';

export default function DeleteMessage({ id }: { id: number }) {
  const router = useRouter();
  return (
    <button type="button" className="linklike small tap" onClick={async () => { if (confirm('Poistetaanko viesti?')) { await deleteMessage(id); router.refresh(); } }}>
      Poista
    </button>
  );
}
