import type { SupabaseClient } from '@supabase/supabase-js';
import { activeWeaknesses, type MonsterPart } from './trio';
import { computeLedger, pledgeHours, seasonHp, STEP_DAY_DAMAGE, PATROL_DAY_DAMAGE, type Sport, type Weakness, type LedgerEvent } from './rules';
import { loadSports } from './sports';
import { testSkipPast } from './today';
import { addDays, graceWeek, helsinkiMs, helsinkiToday, KELA_HOUR, KELA_TIME, seasonWeek, weekRange, BOSS_WEEK, MONSTER_WEEKS, SEASON_END, SEASON_START } from './season';
import { gateResult, type GateRow } from './gate';
import { kelaDays, patrolDays, pledgeForWeek, requiredForSeal, sickDaysBetween, isSickOn, weekPledgeTarget, type SickPeriod } from './weekly';
import { helsinkiHour } from './quiet';

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
  weakness: Weakness | null;
  image_path: string | null;
  parts?: MonsterPart[] | null;
  taunt_half?: string | null;
  taunt_low?: string | null;
  teaser?: string | null;
  boss_whisper?: string | null;
  hit_lines?: string | null;
  hit_crit?: string | null;
  taunt_full?: string | null;
  /** Tulevan viikon heikkoudet vihjeeseen (migraatio 029; ylläpitäjällä lasketaan suoraan taulusta). */
  teaser_weaknesses?: string[] | null;
};

type Hit = { id: number; user_id: string; trained_on: string; sport: string; minutes: number; damage: number; bonus_pct: number; all_together: boolean; companions: string[]; created_at: string; weakness_hit?: boolean; photo_path?: string | null };

const HIT_COLS = 'id, user_id, trained_on, sport, minutes, damage, bonus_pct, all_together, companions, created_at';
/** Iskut; weakness_hit (migraatio 025) ja photo_path (028) mukaan, jos sarakkeet ovat jo olemassa. */
async function loadHits(supabase: SupabaseClient) {
  for (const extra of [', weakness_hit, photo_path', ', weakness_hit', '']) {
    const res = await supabase.from('hits').select(HIT_COLS + extra);
    if (!res.error || !extra) return res;
  }
  throw new Error('unreachable');
}
type Step = { user_id: string; day: string; created_at: string };
type PledgeChange = { user_id: string; from_week: number; hours: number };

/** Lupaukseen kertyneet tunnit viikolla. */
export function hoursInWeek(hits: Hit[], userId: string, week: number, sports: Sport[]) {
  const value = (name: string) => sports.find((s) => s.name === name)?.value ?? 100;
  return hits.filter((h) => h.user_id === userId && seasonWeek(h.trained_on) === week).reduce((a, h) => a + pledgeHours(h.minutes, value(h.sport)), 0);
}

/** Lataa kauden tilanteen ja laskee sen kirjauksista. Kuluva viikko on vielä auki. */
export async function loadBattle(supabase: SupabaseClient, today: string) {
  const [{ data: heroes }, { data: monsters }, { data: publicMonsters }, { data: hits }, { data: steps }, { data: sick }, { data: changes }, sports, { data: gateRow }] = await Promise.all([
    supabase.from('profiles').select('id, hero_name, avatar_path, pledge_locked_at, pledge_hours, birthday, name_day').order('created_at'),
    // Ylläpitäjä saa koko taulun (RLS), muut näkymän, joka piilottaa paljastamattomat tiedot. Haetaan rinnakkain.
    supabase.from('monsters').select('week, hp, name, description, weakness, image_path, parts, taunt_half, taunt_low, teaser, boss_whisper, hit_lines, hit_crit, taunt_full').order('week'),
    supabase.from('monsters_public').select('*').order('week'),
    loadHits(supabase),
    supabase.from('step_days').select('user_id, day, created_at'),
    supabase.from('sick_periods').select('user_id, starts_on, ends_on'),
    supabase.from('pledge_changes').select('user_id, from_week, hours'),
    loadSports(supabase),
    // Portinvartija (migraatio 027). Ilman taulua käytetään oletuksia.
    supabase.from('gate').select('name, description, image_path, hp, taunt').eq('id', 1).maybeSingle(),
  ]);
  const heroList = (heroes ?? []) as Hero[];
  let monsterList = (monsters ?? []) as PublicMonster[];
  if (monsterList.length === 0) monsterList = (publicMonsters ?? []) as PublicMonster[];
  const hitList = (hits ?? []) as unknown as Hit[];
  const periods = (sick ?? []) as SickPeriod[];
  // Sairaspäivänä ei tule askelvoimaa (Kela korvaa), vaikka vanha merkintä olisi jäänyt tietokantaan.
  const stepList = ((steps ?? []) as Step[]).filter((s) => !isSickOn(periods, s.user_id, s.day));
  const changeList = (changes ?? []) as PledgeChange[];
  const participants = heroList.filter((h) => h.pledge_locked_at).map((h) => h.id);
  const week = Math.min(BOSS_WEEK, Math.max(1, seasonWeek(today)));

  // Ennen tavoitteen lukitusta HP:t lasketaan esikatseluna nykyisistä lupauksista (sama kaava kuin lukituksessa),
  // jotta monsterin ja taistelun näkee jo testitilassa.
  const hpLocked = monsterList.length === BOSS_WEEK && monsterList.every((m) => m.hp != null);
  const hpPreview = !hpLocked && monsterList.length === BOSS_WEEK;
  if (hpPreview) {
    const total = heroList.filter((h) => h.pledge_locked_at).reduce((a, h) => a + Number(h.pledge_hours ?? 0), 0);
    const preview = seasonHp(total);
    monsterList = monsterList.map((m) => ({ ...m, hp: m.week === BOSS_WEEK ? preview.boss : preview.monsters[m.week - 1] }));
  }
  // Tulevat monsterit pysyvät salassa myös ylläpitäjältä (testitilassa "tänään" voi olla ennen paljastusta).
  // Seuraavan viikon arvoitus ja heikkoudet näkyvät kuluvan viikon perjantaista alkaen.
  // Ylläpitäjä saa heikkoudet suoraan taulusta, muut näkymästä (migraatio 029).
  const upcomingWeaknesses = (m: PublicMonster) => [...new Set((m.teaser_weaknesses ?? [m.weakness, ...(m.parts ?? []).map((p) => p.weakness)]).filter((w): w is string => Boolean(w)))];
  const teaserOpen = today >= addDays(weekRange(week).end, -2);
  const byWeek = new Map(monsterList.map((m) => [m.week, m.week > week
    ? { ...m, name: null, description: null, weakness: null, image_path: null, parts: null, taunt_half: null, taunt_low: null, boss_whisper: null, hit_lines: null, hit_crit: null, taunt_full: null, teaser: m.week === week + 1 && teaserOpen ? m.teaser ?? null : null,
        teaser_weaknesses: m.week === week + 1 && teaserOpen ? upcomingWeaknesses(m) : null }
    : m]));

  const pledgeOf = (userId: string, w: number) =>
    pledgeForWeek(Number(heroList.find((h) => h.id === userId)?.pledge_hours ?? 0), changeList.filter((c) => c.user_id === userId), w);

  /** Viikon lupaustavoite ja kertyneet tunnit. Kuluvalla viikolla sairaspäivät lasketaan tähän päivään asti. */
  const pledgeStatus = (userId: string, w: number) => {
    const { start, end } = weekRange(w);
    const sickDays = sickDaysBetween(periods, userId, start, end < today ? end : today);
    const target = weekPledgeTarget(pledgeOf(userId, w), w, sickDays);
    const hours = hoursInWeek(hitList, userId, w, sports);
    return { target, hours, kept: target > 0 && hours >= target, sickDays };
  };

  const patrols = patrolDays(stepList, participants, periods);
  // Kela: sairaspäivistä tulee oman lupauksen päiväosuus (kauden päivät tähän päivään asti).
  // Tämän päivän Kela-isku tulee vasta klo 9 (testipäivänä heti).
  const kelaTo = today === helsinkiToday() && helsinkiHour() < KELA_HOUR ? addDays(today, -1) : today;
  const kela = today >= SEASON_START
    ? kelaDays(participants, periods, SEASON_START, kelaTo < SEASON_END ? kelaTo : SEASON_END, (u, d) => pledgeOf(u, seasonWeek(d)))
    : [];
  const sickNow = participants.filter((u) => isSickOn(periods, u, today));
  // Portinvartija: kauden alettua sen jäljelle jäänyt HP lisätään viikon 1 monsterille ja ylijäämä on potissa.
  const gate = gateResult((gateRow ?? null) as GateRow | null, hitList, stepList);
  const gateCarry = today >= SEASON_START;
  const week1 = byWeek.get(1);
  if (gateCarry && gate.left && week1?.hp != null) byWeek.set(1, { ...week1, hp: week1.hp + gate.left });

  // Armonaika: maanantaina klo 12 asti edellinen viikko on vielä auki kirjauksille.
  const grace = graceWeek(today);
  const base = { gate, week, today, grace, heroes: heroList, participants, monsters: byWeek, hits: hitList, steps: stepList, patrols, kela, sickNow, periods, pledgeOf, pledgeStatus, changes: changeList, sports };

  if (!hpLocked && !hpPreview) return { ...base, hpLocked, hpPreview, required: participants, ledger: null, events: [] as LedgerEvent[], ledgerInput: null };

  const events: LedgerEvent[] = [
    ...hitList.map((h) => ({ week: seasonWeek(h.trained_on), at: Date.parse(h.created_at), userId: h.user_id, damage: h.damage, isTraining: true, allTogether: h.all_together })),
    ...stepList.map((s) => ({ week: seasonWeek(s.day), at: Date.parse(s.created_at), userId: s.user_id, damage: STEP_DAY_DAMAGE, isTraining: false })),
    ...patrols.map((p) => ({ week: seasonWeek(p.day), at: Date.parse(p.at) + 1, userId: 'partio', damage: PATROL_DAY_DAMAGE, isTraining: false })),
    ...kela.map((k) => ({ week: seasonWeek(k.day), at: helsinkiMs(k.day, KELA_TIME), userId: k.userId, damage: k.damage, isTraining: false })),
  ];
  const requiredByWeek: Record<number, string[]> = {};
  const pledgeBonusesByWeek: Record<number, number> = {};
  for (let w = 1; w <= week; w++) {
    requiredByWeek[w] = requiredForSeal(participants, periods, w, today);
    if (w < week) pledgeBonusesByWeek[w] = participants.filter((u) => pledgeStatus(u, w).kept).length;
  }
  const monsterHp = monsterList.filter((m) => m.week <= MONSTER_WEEKS).map((m) => (m.week === 1 && gateCarry ? m.hp! + gate.left : m.hp!));
  // Testitila: ylläpitäjä voi kaataa aiemmat viikot automaattisesti, jotta tulevan viikon näkymän näkee
  // ilman kaikkien sankarien iskuja. Keinotekoiset kaadot eivät näy iskuina eivätkä viimeisinä iskuina.
  const testKills: LedgerEvent[] = [];
  if (testSkipPast()) {
    for (let w = 1; w < week && w <= MONSTER_WEEKS; w++) {
      requiredByWeek[w] = [];
      testKills.push({ week: w, at: Date.parse(`${weekRange(w).start}T00:00:00Z`), userId: 'testi', damage: monsterHp[w - 1], isTraining: true });
    }
  }
  const ledgerInput = { monsterHp, bossHp: byWeek.get(BOSS_WEEK)!.hp!, events: [...testKills, ...events], requiredByWeek, pledgeBonusesByWeek, startPot: gateCarry ? gate.surplus : 0 };
  const ledger = computeLedger(ledgerInput, week, true);
  return { ...base, hpLocked, hpPreview, required: requiredByWeek[week], ledger, events, ledgerInput };
}

/** Viikon heikkoudet iskuhetkellä: moniosaisella kaikkien osien heikkoudet koko viikon. */
export function currentWeaknesses(b: { monsters: Map<number, PublicMonster>; ledger: { alive: { week: number; hp: number }[] } | null }, week: number) {
  const m = b.monsters.get(week);
  const f = b.ledger?.alive.find((x) => x.week === week);
  return activeWeaknesses(m, f ? f.hp : b.ledger ? 0 : m?.hp ?? 0);
}
