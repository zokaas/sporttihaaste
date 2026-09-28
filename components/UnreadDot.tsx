'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const KEY = 'mj_msgs_seen';

/** Punainen piste Viestit-kuvakkeeseen, kun muilta on tullut viesti viimeisen käynnin jälkeen. */
export default function UnreadDot({ seenNow = false }: { seenNow?: boolean }) {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    if (seenNow) {
      try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* ei tallennusta */ }
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.from('messages').select('created_at').neq('sender', session.user.id).order('created_at', { ascending: false }).limit(1);
      let seen: string | null = null;
      try { seen = localStorage.getItem(KEY); } catch { /* ei tallennusta */ }
      if (!cancelled && data?.[0] && (!seen || Date.parse(data[0].created_at) > Date.parse(seen))) setUnread(true);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [seenNow]);

  return unread ? <span className="unread-dot" aria-label="Uusia viestejä" /> : null;
}
