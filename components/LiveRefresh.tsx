'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Päivittää näkymän, kun joku kirjaa iskun tai askeleet (Supabase Realtime). */
export default function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: number | undefined;
    let cancelled = false;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase.channel('taistelu');
    // Tilaus vasta kirjautumisen jälkeen: muuten kanava liittyy anonyyminä, eikä RLS päästä muiden iskuja läpi.
    (async () => {
      await supabase.auth.getSession();
      if (cancelled) return;
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hits' }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'step_days' }, refresh)
        .subscribe();
    })();
    const onFocus = () => document.visibilityState === 'visible' && router.refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onFocus);
      supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
