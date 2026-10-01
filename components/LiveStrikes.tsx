'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { currentStrike } from '@/app/actions';
import { showStrike } from '@/components/StrikeToastHost';
import { STEP_DAY_DAMAGE, hitBonusText } from '@/lib/rules';

export const SEEN_KEY = 'mj_seen_until';
export const markSeen = () => { try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch { /* ei tallennusta */ } };

type HitRow = { user_id: string; sport: string; minutes: number; damage: number; bonus_pct: number; all_together: boolean; companions: string[]; weakness_hit?: boolean };
type StepRow = { user_id: string };

/**
 * Kun joku muu kirjaa iskun tai askeleet sovelluksen ollessa auki, ylös liukuu iskuikkuna
 * ("⚔️ Matti · Juoksu 45 min −150") millä sivulla tahansa. Sivu ei liiku.
 */
export default function LiveStrikes() {
  useEffect(() => {
    const supabase = createClient();
    let me: string | null = null;
    const names = new Map<string, string>();
    let cancelled = false;

    const announce = async (userId: string, damage: number, label: string, detail: string) => {
      if (userId === me || document.visibilityState !== 'visible') return;
      const strike = await currentStrike().catch(() => null);
      if (!strike || cancelled) return;
      markSeen();
      showStrike({ strike, damage, label: `${label} ${names.get(userId) ?? 'Sankari'}`, detail });
    };

    const channel = supabase.channel('iskuikkunat');
    (async () => {
      const { data } = await supabase.auth.getSession();
      me = data.session?.user.id ?? null;
      if (!me || cancelled) return;
      const { data: heroes } = await supabase.from('profiles').select('id, hero_name');
      for (const h of heroes ?? []) names.set(h.id, h.hero_name ?? 'Sankari');
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hits' }, (p) => {
          const h = p.new as HitRow;
          const bonus = h.bonus_pct ? hitBonusText({ ...h, companions: h.companions ?? [] }) : '';
          void announce(h.user_id, h.damage, '⚔️', `${h.sport} ${h.minutes} min${bonus ? ` · ${bonus}` : ''}`);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'step_days' }, (p) => {
          const s = p.new as StepRow;
          void announce(s.user_id, STEP_DAY_DAMAGE, '👣', '10 000 askelta');
        })
        .subscribe();
    })();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);
  return null;
}
