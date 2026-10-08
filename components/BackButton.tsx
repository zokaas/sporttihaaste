'use client';
import { useRouter } from 'next/navigation';
import { cameFromApp } from '@/lib/navHistory';

/**
 * Takaisin edelliselle sivulle samaan vierityskohtaan (kotinäytön sovelluksessa ei ole selaimen takaisin-nappia).
 * Jos sivu avattiin suoraan (esim. ilmoituksesta), vie `fallback`-sivulle.
 */
export default function BackButton({ fallback, label = 'Takaisin' }: { fallback: string; label?: string }) {
  const router = useRouter();
  return (
    <button type="button" className="back-link muted tap" onClick={() => (cameFromApp() ? router.back() : router.push(fallback))}>
      ← {label}
    </button>
  );
}
