import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBattle } from './battle';
import { sealView } from './rules';
import { hitReaction } from './taunts';
import { BOSS_WEEK } from './season';
import { monsterImageUrl } from './supabase/client';

export type StrikeSummary = { name: string; image: string | null; hp: number; maxHp: number; reaction: string } | null;

/** Nykyisen vastustajan tilanne juuri tehdyn kirjauksen jälkeen: näytetään pienessä iskuikkunassa. */
export async function strikeSummary(supabase: SupabaseClient, today: string): Promise<StrikeSummary> {
  const b = await loadBattle(supabase, today);
  const target = b.ledger?.alive[0];
  if (!target) return null;
  const m = b.monsters.get(target.week);
  const view = sealView(target, b.required);
  return {
    name: m?.name ?? (target.week === BOSS_WEEK ? 'Loppupomo' : `Viikon ${target.week} monsteri`),
    image: monsterImageUrl(m?.image_path),
    hp: view.hp,
    maxHp: m?.hp ?? 1,
    reaction: hitReaction(m?.hit_lines, m?.hit_crit, false),
  };
}
