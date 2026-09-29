// Monsterijahti – pelisäännöt puhtaina funktioina.
// Kaikki pelitila lasketaan aina uudelleen kirjauksista, joten myöhästyneet
// kirjaukset ja korjaukset menevät automaattisesti oikein.

import { BOSS_WEEK, MONSTER_WEEKS } from './season.ts';
export { BOSS_WEEK, MONSTER_WEEKS };

export type Category = 'Kestävyys' | 'Voimailu' | 'Palloilu' | 'Muu';

export type Sport = { name: string; value: number; category: Category };
export const CATEGORIES: Category[] = ['Kestävyys', 'Voimailu', 'Palloilu', 'Muu'];
export const SPORT_VALUES = [50, 100, 200] as const;

/** Kauden alun lajit. Ylläpito voi lisätä lajeja (taulu sports, migraatio 023); tätä listaa käytetään, jos taulua ei vielä ole. */
export const SPORTS: Sport[] = [
  { name: 'Sali', value: 100, category: 'Voimailu' },
  { name: 'Crossfit', value: 100, category: 'Voimailu' },
  { name: 'Pump', value: 100, category: 'Voimailu' },
  { name: 'Kehonpainotreeni', value: 100, category: 'Voimailu' },
  { name: 'Kiipeily/boulderointi', value: 100, category: 'Voimailu' },
  { name: 'Pilates', value: 100, category: 'Voimailu' },
  { name: 'Juoksu', value: 100, category: 'Kestävyys' },
  { name: 'Pyöräily', value: 100, category: 'Kestävyys' },
  { name: 'Hiihto', value: 100, category: 'Kestävyys' },
  { name: 'Uinti', value: 200, category: 'Kestävyys' },
  { name: 'HIIT', value: 100, category: 'Kestävyys' },
  { name: 'Spinning', value: 100, category: 'Kestävyys' },
  { name: 'Soutu', value: 100, category: 'Kestävyys' },
  { name: 'Porrastreeni', value: 100, category: 'Kestävyys' },
  { name: 'Tanssi', value: 100, category: 'Kestävyys' },
  { name: 'Vaellus (syke ylös)', value: 100, category: 'Kestävyys' },
  { name: 'Tennis', value: 100, category: 'Palloilu' },
  { name: 'Padel', value: 100, category: 'Palloilu' },
  { name: 'Squash', value: 100, category: 'Palloilu' },
  { name: 'Sulkapallo', value: 100, category: 'Palloilu' },
  { name: 'Jalkapallo', value: 100, category: 'Palloilu' },
  { name: 'Jääkiekko', value: 100, category: 'Palloilu' },
  { name: 'Salibandy', value: 100, category: 'Palloilu' },
  { name: 'Koripallo', value: 100, category: 'Palloilu' },
  { name: 'Lentopallo', value: 100, category: 'Palloilu' },
  { name: 'Kamppailulaji', value: 100, category: 'Muu' },
  { name: 'Jooga', value: 50, category: 'Muu' },
  { name: 'Liikkuvuus', value: 50, category: 'Muu' },
  { name: 'Golf', value: 50, category: 'Muu' },
  { name: 'Laskettelu', value: 50, category: 'Muu' },
];

export const PARTICIPANTS = 10;
export const STEP_GOAL = 10000; // askelta päivässä, jotta päivän voi kuitata
export const STEP_DAY_DAMAGE = 50;
export const PATROL_DAY_DAMAGE = 250;
export const PLEDGE_BONUS = 100;
export const BONUS_CAP_PCT = 200;
export const STEPS_WEEKLY_ESTIMATE = 2750; // 10 × 5 pv × 50 + 1 megamarssi

// ---------- Yksittäinen isku ----------

export interface HitInput {
  minutes: number;
  sportValue: number; // 50 / 100 / 200 per tunti
  category: Category;
  groupSize: number; // kirjaaja + merkityt seuralaiset
  celebration: boolean; // nimi- tai syntymäpäivä jollakulla
  /** Viikon monsterin heikkous: lajiryhmä (esim. "Kestävyys") tai yksittäinen laji (esim. "Uinti"). Moniosaisella useampi. */
  weakness: Weakness | Weakness[] | null;
  participants?: number; // ilmoittautuneiden määrä ("kaikki yhdessä"), oletus 10
  sport?: string; // lajin nimi: osuuko yksittäisen lajin heikkouteen
  special?: string | null; // kirjaajan merkitsemä erikoisheikkous (SPECIAL_WEAKNESSES)
}

/** Heikkous on lajiryhmä, yksittäisen lajin nimi tai erikoisheikkous (SPECIAL_WEAKNESSES). */
export type Weakness = Category | string;

/**
 * Erikoisheikkoudet: mikä tahansa laji käy, ja kirjaaja merkitsee itse, että ehto täyttyi.
 * Avain on heikkouden nimi (näkyy monsterilla), check on kirjauksen valinnan teksti ja log iskulistan merkintä.
 */
export const SPECIAL_WEAKNESSES: Record<string, { check: string; log: string }> = {
  'Urheilu mamun tai lapsen kanssa': { check: 'Urheilin mamun tai lapsen kanssa', log: 'mamun tai lapsen kanssa' },
  'Urheilija on nainen': { check: 'Olen nainen', log: 'nainen' },
  'Urheilu kenen tahansa isän kanssa': { check: 'Urheilin jonkun isän kanssa', log: 'isän kanssa' },
};
export const FAMILY_WEAKNESS = 'Urheilu mamun tai lapsen kanssa';
/** Viikon erikoisheikkous (vuorossa olevan osan), jos sellainen on. */
export const specialOf = (weaknesses: Weakness[]) => weaknesses.find((w) => w in SPECIAL_WEAKNESSES) ?? null;

/** Osuuko isku heikkouteen: juuri tämä laji, sen lajiryhmä tai kirjaajan merkitsemä erikoisheikkous. Palauttaa osuman nimen. */
export function weaknessHit(weaknesses: Weakness[], category: Category, sport?: string, special?: string | null) {
  if (sport && weaknesses.includes(sport)) return sport;
  if (weaknesses.includes(category)) return category;
  return special && special in SPECIAL_WEAKNESSES && weaknesses.includes(special) ? special : null;
}

export function hitDamage(h: HitInput) {
  const base = Math.round((h.minutes / 60) * h.sportValue);
  const bonuses: { label: string; pct: number }[] = [];
  const all = h.participants ?? PARTICIPANTS;
  if (h.groupSize >= all && all >= 3) bonuses.push({ label: 'Koko porukka yhdessä', pct: 100 });
  else if (h.groupSize >= 3) bonuses.push({ label: `Yhdessä (${h.groupSize} henkeä)`, pct: 50 });
  if (h.celebration) bonuses.push({ label: 'Juhlapäivä', pct: 50 });
  const weaknesses = Array.isArray(h.weakness) ? h.weakness : h.weakness ? [h.weakness] : [];
  const hit = weaknessHit(weaknesses, h.category, h.sport, h.special);
  if (hit) bonuses.push({ label: `Heikkous: ${hit}`, pct: 50 });
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

/** Viikkovauhti: täytetyt lupaukset ilman bonuksia + arvioidut askeleet. */
export function weeklyPace(totalPledgeHours: number) {
  return totalPledgeHours * 100 + STEPS_WEEKLY_ESTIMATE;
}

/**
 * HP viikoille 1–11 ja loppupomolle (viikko 12). Pelkät lupaukset ja askeleet eivät riitä:
 * viikko 1 kestää vain to–su (4 pv), joten sen HP on 4/7 × 1,2 × vauhti: kaatuu, kun porukka pitää lupauksensa
 * ja tekee vähän päälle, eikä jää roikkumaan rästiksi toiselle viikolle.
 * Viikot 2–11 kasvavat 1,05 → 1,15 × vauhti, loppupomo 1,5 × vauhti (koko potti vähentää sitä).
 */
export function seasonHp(totalPledgeHours: number) {
  const pace = weeklyPace(totalPledgeHours);
  const monsters: number[] = [round500((4 / 7) * 1.2 * pace)];
  for (let i = 0; i < MONSTER_WEEKS - 1; i++) monsters.push(round500(pace * (1.05 + (0.1 * i) / (MONSTER_WEEKS - 2))));
  const boss = round500(1.5 * pace);
  return { pace: Math.round(pace), monsters, boss };
}

// ---------- Kauden kirjanpito ----------

export interface LedgerEvent {
  week: number; // 1–12
  at: number; // kirjaushetki (ms), määrää järjestyksen
  userId: string;
  damage: number;
  isTraining: boolean; // askeleet ja megamarssit eivät täytä sinettiä
  allTogether?: boolean; // koko porukka yhdessä (vain tilastoihin)
}

export interface LedgerInput {
  monsterHp: number[]; // viikot 1–11
  bossHp: number;
  events: LedgerEvent[];
  requiredByWeek: Record<number, string[]>; // terveet osallistujat viikolla
  pledgeBonusesByWeek: Record<number, number>; // pidettyjen lupausten määrä
}

interface Fighter { week: number; hp: number; hitters: Set<string>; killedAt?: number; boss?: boolean }

/**
 * Laskee kauden tilanteen viikon uptoWeek loppuun. Jos weekOpen on tosi, viimeinen viikko on vielä
 * kesken: sunnuntain käsittely (padotun vahingon menetys ja lupausbonukset) jätetään tekemättä.
 */
export function computeLedger(input: LedgerInput, uptoWeek = BOSS_WEEK, weekOpen = false) {
  const queue: Fighter[] = [];
  const done: Fighter[] = [];
  let pot = 0;
  let lostToSeal = 0;

  const sealFull = (f: Fighter, week: number) =>
    (input.requiredByWeek[week] ?? []).every((u) => f.hitters.has(u));

  const tryKill = (f: Fighter, week: number, at: number) => {
    if (f.hp > 0) return false;
    if (!sealFull(f, week)) return false;
    f.killedAt = at;
    return true;
  };

  for (let w = 1; w <= Math.min(uptoWeek, BOSS_WEEK); w++) {
    if (w <= MONSTER_WEEKS) queue.push({ week: w, hp: input.monsterHp[w - 1], hitters: new Set() });
    else {
      // Koko potti iskee loppupomoon sen herätessä; kattoa ei ole. Jos potti ylittää HP:n, loput odottaa sinettiä.
      const boss: Fighter = { week: BOSS_WEEK, hp: input.bossHp - pot, hitters: new Set(), boss: true };
      pot = 0;
      queue.push(boss);
    }

    const events = input.events.filter((e) => e.week === w).sort((a, b) => a.at - b.at);
    for (const e of events) {
      let dmg = e.damage;
      let i = 0;
      while (dmg > 0 && i < queue.length) {
        const f = queue[i];
        if (e.isTraining) f.hitters.add(e.userId);
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
            else if (w <= MONSTER_WEEKS) pot += overflow;
          }
        }
      }
      if (dmg > 0 && w <= MONSTER_WEEKS) pot += dmg; // viikon monsteri kaatunut → pottiin
    }

    if (weekOpen && w === uptoWeek) break;

    // Sunnuntai: padottu vahinko menetetään, eloon jääneet jatkavat 1 HP:lla.
    for (const f of queue) {
      if (f.hp <= 0) {
        lostToSeal += -f.hp;
        f.hp = 1;
      }
    }
    if (w <= MONSTER_WEEKS) pot += (input.pledgeBonusesByWeek[w] ?? 0) * PLEDGE_BONUS;
  }

  return {
    pot,
    lostToSeal,
    alive: queue.map((f) => ({ week: f.week, hp: Math.max(1, f.hp), padded: f.hp <= 0 ? -f.hp : 0, hitters: [...f.hitters] })),
    killed: done.map((f) => ({ week: f.week, killedAt: f.killedAt })),
  };
}

// ---------- Sinettiraja (näyttö) ----------

/** Monsterin HP ei näy nollana, kun sinetti on kesken: jokainen puuttuva sankari pitää sille 10 HP. */
export const SEAL_FLOOR_HP = 10;

/**
 * Näytettävä HP ja pato. Sinetin ollessa kesken HP pysyy vähintään sinettirajassa
 * (10 HP × puuttuvat), ja rajan alle mennyt vahinko näkyy patona. Kirjanpito ei muutu.
 */
export function sealView(f: { hp: number; padded: number; hitters: string[] }, required: string[]) {
  const missing = required.filter((id) => !f.hitters.includes(id)).length;
  const trueHp = f.padded > 0 ? -f.padded : f.hp;
  const floor = SEAL_FLOOR_HP * missing;
  if (missing === 0) return { hp: Math.max(0, trueHp), dam: Math.max(0, -trueHp), missing, floor };
  return { hp: Math.max(trueHp, floor), dam: Math.max(0, floor - trueHp), missing, floor };
}
