import type { SupabaseClient } from '@supabase/supabase-js';
import { computeLedger, type Category } from './rules';
import { seasonWeek } from './season';

export type Hero = {
  id: string;
  hero_name: string | null;
  avatar_path: string | null;
  pledge_locked_at: string | null;
  birthday: string | null;
  name_day: string | null;
};

export type PublicMonster = {
  week: number;
  hp: number | null;
  name: string | null;
  description: string | null;
  weakness: Category | null;
  image_path: string | null;
};

/** Lataa kauden tilanteen ja laskee sen kirjauksista. Kuluva viikko on vielä auki. */
export async function loadBattle(supabase: SupabaseClient, today: string) {
  const [{ data: heroes }, { data: monsters }, { data: hits }] = await Promise.all([
    supabase.from('profiles').select('id, hero_name, avatar_path, pledge_locked_at, birthday, name_day').order('created_at'),
    supabase.from('monsters_public').select('*').order('week'),
    supabase.from('hits').select('user_id, trained_on, damage, all_together, created_at'),
  ]);
  const heroList = (heroes ?? []) as Hero[];
  const monsterList = (monsters ?? []) as PublicMonster[];
  const participants = heroList.filter((h) => h.pledge_locked_at).map((h) => h.id);
  const week = Math.min(11, Math.max(1, seasonWeek(today)));
  const byWeek = new Map(monsterList.map((m) => [m.week, m]));

  const hpLocked = monsterList.length === 11 && monsterList.every((m) => m.hp != null);
  if (!hpLocked) return { hpLocked, week, heroes: heroList, participants, monsters: byWeek, ledger: null };

  const requiredByWeek: Record<number, string[]> = {};
  for (let w = 1; w <= 11; w++) requiredByWeek[w] = participants;
  const ledger = computeLedger(
    {
      monsterHp: monsterList.filter((m) => m.week <= 10).map((m) => m.hp!),
      bossHp: byWeek.get(11)!.hp!,
      events: (hits ?? []).map((h) => ({
        week: seasonWeek(h.trained_on),
        at: Date.parse(h.created_at),
        userId: h.user_id,
        damage: h.damage,
        isTraining: true,
        allTogether: h.all_together,
      })),
      requiredByWeek,
      pledgeBonusesByWeek: {},
    },
    week,
    true,
  );
  return { hpLocked, week, heroes: heroList, participants, monsters: byWeek, ledger };
}
