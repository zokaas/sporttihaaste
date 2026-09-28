import type { SupabaseClient } from '@supabase/supabase-js';
import { computeLedger, pledgeHours, SPORTS, STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE, type Category, type LedgerEvent } from './rules';
import { seasonWeek, weekRange } from './season';
import { patrolDays, pledgeForWeek, requiredForSeal, sickDaysBetween, isSickOn, weekPledgeTarget, type SickPeriod } from './weekly';

export type Hero = {
  id: string;
  hero_name: string | null;
  avatar_path: string | null;
  pledge_locked_at: string | null;
  pledge_hours: number | null;
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

type Hit = { id: number; user_id: string; trained_on: string; sport: string; minutes: number; damage: number; bonus_pct: number; all_together: boolean; companions: string[]; created_at: string };
type Step = { user_id: string; day: string; created_at: string };
type PledgeChange = { user_id: string; from_week: number; hours: number };

const sportValue = (name: string) => SPORTS.find((s) => s.name === name)?.value ?? 100;

/** Lupaukseen kertyneet tunnit viikolla. */
export function hoursInWeek(hits: Hit[], userId: string, week: number) {
  return hits.filter((h) => h.user_id === userId && seasonWeek(h.trained_on) === week).reduce((a, h) => a + pledgeHours(h.minutes, sportValue(h.sport)), 0);
}

/** Lataa kauden tilanteen ja laskee sen kirjauksista. Kuluva viikko on vielä auki. */
export async function loadBattle(supabase: SupabaseClient, today: string) {
  const [{ data: heroes }, { data: monsters }, { data: hits }, { data: steps }, { data: sick }, { data: changes }] = await Promise.all([
    supabase.from('profiles').select('id, hero_name, avatar_path, pledge_locked_at, pledge_hours, birthday, name_day').order('created_at'),
    // Ylläpitäjä saa koko taulun (RLS), muut näkymän, joka piilottaa paljastamattomat tiedot.
    supabase.from('monsters').select('week, hp, name, description, weakness, image_path').order('week'),
    supabase.from('hits').select('id, user_id, trained_on, sport, minutes, damage, bonus_pct, all_together, companions, created_at'),
    supabase.from('step_days').select('user_id, day, created_at'),
    supabase.from('sick_periods').select('user_id, starts_on, ends_on'),
    supabase.from('pledge_changes').select('user_id, from_week, hours'),
  ]);
  const heroList = (heroes ?? []) as Hero[];
  let monsterList = (monsters ?? []) as PublicMonster[];
  if (monsterList.length === 0) {
    monsterList = ((await supabase.from('monsters_public').select('*').order('week')).data ?? []) as PublicMonster[];
  }
  const hitList = (hits ?? []) as Hit[];
  const stepList = (steps ?? []) as Step[];
  const periods = (sick ?? []) as SickPeriod[];
  const changeList = (changes ?? []) as PledgeChange[];
  const participants = heroList.filter((h) => h.pledge_locked_at).map((h) => h.id);
  const week = Math.min(11, Math.max(1, seasonWeek(today)));
  // Tulevat monsterit pysyvät salassa myös ylläpitäjältä (testitilassa "tänään" voi olla ennen paljastusta).
  const byWeek = new Map(monsterList.map((m) => [m.week, m.week > week ? { ...m, name: null, description: null, weakness: null, image_path: null } : m]));

  const pledgeOf = (userId: string, w: number) =>
    pledgeForWeek(Number(heroList.find((h) => h.id === userId)?.pledge_hours ?? 0), changeList.filter((c) => c.user_id === userId), w);

  /** Viikon lupaustavoite ja kertyneet tunnit. Kuluvalla viikolla sairaspäivät lasketaan tähän päivään asti. */
  const pledgeStatus = (userId: string, w: number) => {
    const { start, end } = weekRange(w);
    const sickDays = sickDaysBetween(periods, userId, start, end < today ? end : today);
    const target = weekPledgeTarget(pledgeOf(userId, w), w, sickDays);
    const hours = hoursInWeek(hitList, userId, w);
    return { target, hours, kept: target > 0 && hours >= target, sickDays };
  };

  const patrols = patrolDays(stepList, participants, periods);
  const sickNow = participants.filter((u) => isSickOn(periods, u, today));
  const base = { week, today, heroes: heroList, participants, monsters: byWeek, hits: hitList, steps: stepList, patrols, sickNow, periods, pledgeOf, pledgeStatus, changes: changeList };

  const hpLocked = monsterList.length === 11 && monsterList.every((m) => m.hp != null);
  if (!hpLocked) return { ...base, hpLocked, required: participants, ledger: null, events: [] as LedgerEvent[], ledgerInput: null };

  const events: LedgerEvent[] = [
    ...hitList.map((h) => ({ week: seasonWeek(h.trained_on), at: Date.parse(h.created_at), userId: h.user_id, damage: h.damage, isTraining: true, allTogether: h.all_together })),
    ...stepList.map((s) => ({ week: seasonWeek(s.day), at: Date.parse(s.created_at), userId: s.user_id, damage: STEP_DAY_DAMAGE, isTraining: false })),
    ...patrols.map((p) => ({ week: seasonWeek(p.day), at: Date.parse(p.at) + 1, userId: 'partio', damage: PATROL_DAY_DAMAGE, isTraining: false })),
  ];
  const requiredByWeek: Record<number, string[]> = {};
  const pledgeBonusesByWeek: Record<number, number> = {};
  for (let w = 1; w <= week; w++) {
    requiredByWeek[w] = requiredForSeal(participants, periods, w, today);
    if (w < week) pledgeBonusesByWeek[w] = participants.filter((u) => pledgeStatus(u, w).kept).length;
  }
  const ledgerInput = { monsterHp: monsterList.filter((m) => m.week <= 10).map((m) => m.hp!), bossHp: byWeek.get(11)!.hp!, events, requiredByWeek, pledgeBonusesByWeek };
  const ledger = computeLedger(ledgerInput, week, true);
  return { ...base, hpLocked, required: requiredByWeek[week], ledger, events, ledgerInput };
}

/** Viikon monsterin nimi ja heikkous. Ylläpitäjä lukee taulusta (toimii testitilassa ennen paljastusta). */
export async function monsterOfWeek(supabase: SupabaseClient, week: number) {
  const own = await supabase.from('monsters').select('name, weakness').eq('week', week).maybeSingle();
  if (own.data) return own.data as { name: string | null; weakness: Category | null };
  const pub = await supabase.from('monsters_public').select('name, weakness').eq('week', week).maybeSingle();
  return (pub.data ?? { name: null, weakness: null }) as { name: string | null; weakness: Category | null };
}
