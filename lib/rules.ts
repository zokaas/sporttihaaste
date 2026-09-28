// Monsterijahti – pelisäännöt puhtaina funktioina.
// Kaikki pelitila lasketaan aina uudelleen kirjauksista, joten myöhästyneet
// kirjaukset ja korjaukset menevät automaattisesti oikein.

export type Category = 'Kestävyys' | 'Voimailu' | 'Palloilu' | 'Muu';

export const SPORTS: { name: string; value: number; category: Category }[] = [
  { name: 'Sali', value: 100, category: 'Voimailu' },
  { name: 'Crossfit', value: 100, category: 'Voimailu' },
  { name: 'Pump', value: 100, category: 'Voimailu' },
  { name: 'Kehonpainotreeni', value: 100, category: 'Voimailu' },
  { name: 'Juoksu', value: 100, category: 'Kestävyys' },
  { name: 'Pyöräily', value: 100, category: 'Kestävyys' },
  { name: 'Hiihto', value: 100, category: 'Kestävyys' },
  { name: 'Uinti', value: 200, category: 'Kestävyys' },
  { name: 'HIIT', value: 100, category: 'Kestävyys' },
  { name: 'Spinning', value: 100, category: 'Kestävyys' },
  { name: 'Tennis', value: 100, category: 'Palloilu' },
  { name: 'Padel', value: 100, category: 'Palloilu' },
  { name: 'Squash', value: 100, category: 'Palloilu' },
  { name: 'Sulkapallo', value: 100, category: 'Palloilu' },
  { name: 'Jalkapallo', value: 100, category: 'Palloilu' },
  { name: 'Jääkiekko', value: 100, category: 'Palloilu' },
  { name: 'Kamppailulaji', value: 100, category: 'Muu' },
  { name: 'Jooga', value: 50, category: 'Muu' },
  { name: 'Liikkuvuus', value: 50, category: 'Muu' },
  { name: 'Golf', value: 50, category: 'Muu' },
];

export const PARTICIPANTS = 10;
export const STEP_GOAL = 10000; // askelta päivässä, jotta päivän voi kuitata
export const STEP_DAY_DAMAGE = 50;
export const PATROL_DAY_DAMAGE = 250;
export const PLEDGE_BONUS = 100;
export const BONUS_CAP_PCT = 200;
export const BONUS_FACTOR = 1.2; // bonusten arvioitu vaikutus viikkovauhtiin
export const STEPS_WEEKLY_ESTIMATE = 2750; // 10 × 5 pv × 50 + 1 partiopäivä
export const SEASON_WEEKS = 11.6;

// ---------- Yksittäinen isku ----------

export interface HitInput {
  minutes: number;
  sportValue: number; // 50 / 100 / 200 per tunti
  category: Category;
  groupSize: number; // kirjaaja + merkityt seuralaiset
  celebration: boolean; // nimi- tai syntymäpäivä jollakulla
  weakness: Category | Category[] | null; // viikon monsterin heikkous (kolmikolla useampi)
  participants?: number; // ilmoittautuneiden määrä ("kaikki yhdessä"), oletus 10
}

export function hitDamage(h: HitInput) {
  const base = Math.round((h.minutes / 60) * h.sportValue);
  const bonuses: { label: string; pct: number }[] = [];
  const all = h.participants ?? PARTICIPANTS;
  if (h.groupSize >= all && all >= 3) bonuses.push({ label: 'Koko porukka yhdessä', pct: 100 });
  else if (h.groupSize >= 3) bonuses.push({ label: `Yhdessä (${h.groupSize} henkeä)`, pct: 50 });
  if (h.celebration) bonuses.push({ label: 'Juhlapäivä', pct: 50 });
  const weaknesses = Array.isArray(h.weakness) ? h.weakness : h.weakness ? [h.weakness] : [];
  if (weaknesses.includes(h.category)) bonuses.push({ label: `Heikkous: ${h.category}`, pct: 50 });
  const pct = Math.min(BONUS_CAP_PCT, bonuses.reduce((a, b) => a + b.pct, 0));
  return { base, bonuses, pct, damage: Math.round(base * (1 + pct / 100)) };
}

/** Lupaukseen kertyvät tunnit: vahinko ilman bonuksia / 100. */
export function pledgeHours(minutes: number, sportValue: number) {
  return ((minutes / 60) * sportValue) / 100;
}

/** Sairauden suhteuttama lupaus, pyöristettynä lähimpään puoleen tuntiin. */
export function adjustedPledge(pledge: number, sickDays: number) {
  const healthy = Math.max(0, 7 - Math.min(7, sickDays));
  return Math.round(((pledge * healthy) / 7) * 2) / 2;
}

// ---------- Tavoite ja HP ----------

const round500 = (x: number) => Math.round(x / 500) * 500;

export function weeklyPace(totalPledgeHours: number) {
  return totalPledgeHours * 100 * BONUS_FACTOR + STEPS_WEEKLY_ESTIMATE;
}

/** HP viikoille 1–10 ja loppupomolle (viikko 11). */
export function seasonHp(totalPledgeHours: number) {
  const pace = weeklyPace(totalPledgeHours);
  const monsters: number[] = [];
  monsters.push(round500(0.8 * pace * (11 / 7))); // viikko 1 on pidennetty
  for (let i = 0; i < 9; i++) monsters.push(round500(pace * (0.82 + (0.18 * i) / 8)));
  const boss = round500(1.5 * pace);
  return { pace: Math.round(pace), monsters, boss, potCap: Math.floor(boss / 2) };
}

// ---------- Kauden kirjanpito ----------

export interface LedgerEvent {
  week: number; // 1–11
  at: number; // kirjaushetki (ms), määrää järjestyksen
  userId: string;
  damage: number;
  isTraining: boolean; // askeleet ja partiopäivät eivät täytä sinettiä
  allTogether?: boolean; // koko porukka yhdessä (loppupomon viimeinen isku)
}

export interface LedgerInput {
  monsterHp: number[]; // viikot 1–10
  bossHp: number;
  events: LedgerEvent[];
  requiredByWeek: Record<number, string[]>; // terveet osallistujat viikolla
  pledgeBonusesByWeek: Record<number, number>; // pidettyjen lupausten määrä
}

interface Fighter { week: number; hp: number; hitters: Set<string>; killedAt?: number; boss?: boolean; finalBlow?: boolean }

/**
 * Laskee kauden tilanteen viikon uptoWeek loppuun. Jos weekOpen on tosi, viimeinen viikko on vielä
 * kesken: sunnuntain käsittely (padotun vahingon menetys ja lupausbonukset) jätetään tekemättä.
 */
export function computeLedger(input: LedgerInput, uptoWeek = 11, weekOpen = false) {
  const queue: Fighter[] = [];
  const done: Fighter[] = [];
  let pot = 0;
  let lostToSeal = 0;
  const potCap = Math.floor(input.bossHp / 2);

  const sealFull = (f: Fighter, week: number) =>
    (input.requiredByWeek[week] ?? []).every((u) => f.hitters.has(u));

  const tryKill = (f: Fighter, week: number, at: number) => {
    if (f.hp > 0) return false;
    if (f.boss && !f.finalBlow) return false;
    if (!sealFull(f, week)) return false;
    f.killedAt = at;
    return true;
  };

  for (let w = 1; w <= Math.min(uptoWeek, 11); w++) {
    if (w <= 10) queue.push({ week: w, hp: input.monsterHp[w - 1], hitters: new Set() });
    else {
      const boss: Fighter = { week: 11, hp: input.bossHp - Math.min(pot, potCap), hitters: new Set(), boss: true };
      pot -= Math.min(pot, potCap);
      queue.push(boss);
    }

    const events = input.events.filter((e) => e.week === w).sort((a, b) => a.at - b.at);
    for (const e of events) {
      let dmg = e.damage;
      let i = 0;
      while (dmg > 0 && i < queue.length) {
        const f = queue[i];
        if (e.isTraining) f.hitters.add(e.userId);
        if (f.boss && e.allTogether) f.finalBlow = true;
        f.hp -= dmg;
        dmg = 0;
        if (tryKill(f, w, e.at)) {
          dmg = -f.hp; // ylijäämä jatkaa seuraavaan
          f.hp = 0;
          done.push(f);
          queue.splice(i, 1);
        } else {
          i++;
        }
      }
      // Sinetti voi täyttyä myös pienellä iskulla, kun HP on jo nollassa.
      for (let j = 0; j < queue.length; j++) {
        const f = queue[j];
        if (e.isTraining) f.hitters.add(e.userId);
        if (tryKill(f, w, e.at)) {
          const overflow = -f.hp;
          f.hp = 0;
          done.push(f);
          queue.splice(j, 1);
          j--;
          if (overflow > 0) {
            if (queue.length) queue[0].hp -= overflow;
            else if (w <= 10) pot += overflow;
          }
        }
      }
      if (dmg > 0 && w <= 10) pot += dmg; // viikon monsteri kaatunut → pottiin
    }

    if (weekOpen && w === uptoWeek) break;

    // Sunnuntai: padottu vahinko menetetään, eloon jääneet jatkavat 1 HP:lla.
    for (const f of queue) {
      if (f.hp <= 0) {
        lostToSeal += -f.hp;
        f.hp = 1;
      }
    }
    if (w <= 10) pot += (input.pledgeBonusesByWeek[w] ?? 0) * PLEDGE_BONUS;
  }

  return {
    pot,
    potCap,
    lostToSeal,
    alive: queue.map((f) => ({ week: f.week, hp: Math.max(1, f.hp), padded: f.hp <= 0 ? -f.hp : 0, hitters: [...f.hitters] })),
    killed: done.map((f) => ({ week: f.week, killedAt: f.killedAt })),
  };
}
