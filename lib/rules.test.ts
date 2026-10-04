// Aja: node --experimental-strip-types lib/rules.test.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hitDamage, adjustedPledge, seasonHp, computeLedger, pledgeHours } from './rules.ts';

// Vahinko: 1 h salia kolmestaan, heikkous voimailu → 200
assert.equal(hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 3, celebration: false, weakness: 'Voimailu' }).damage, 200);
// Kaikki bonukset: katto +200 %
assert.equal(hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 10, celebration: true, weakness: 'Voimailu' }).damage, 300);
// Yhdeksän ilmoittautunutta: kaikki yhdeksän yhdessä saa +100 %
assert.equal(hitDamage({ minutes: 60, sportValue: 100, category: 'Muu', groupSize: 9, celebration: false, weakness: null, participants: 9 }).pct, 100);
// Kolmikko: heikkousbonus, jos laji osuu minkä tahansa osan heikkouteen
assert.equal(hitDamage({ minutes: 60, sportValue: 100, category: 'Palloilu', groupSize: 1, celebration: false, weakness: ['Voimailu', 'Palloilu'] }).pct, 50);
assert.equal(hitDamage({ minutes: 60, sportValue: 100, category: 'Muu', groupSize: 1, celebration: false, weakness: ['Voimailu', 'Palloilu'] }).pct, 0);
// Yksittäisen lajin heikkous: vain juuri se laji saa bonuksen, ei muu saman ryhmän laji
const uinti = hitDamage({ minutes: 60, sportValue: 200, category: 'Kestävyys', sport: 'Uinti', groupSize: 1, celebration: false, weakness: 'Uinti' });
assert.equal(uinti.pct, 50);
assert.equal(uinti.bonuses[0].label, 'Heikkous: Uinti');
assert.equal(hitDamage({ minutes: 60, sportValue: 100, category: 'Kestävyys', sport: 'Juoksu', groupSize: 1, celebration: false, weakness: 'Uinti' }).pct, 0);
// Lajiryhmä toimii kuten ennen, ja laji + ryhmä samassa kaksikossa ei tuplaa bonusta
assert.equal(hitDamage({ minutes: 60, sportValue: 200, category: 'Kestävyys', sport: 'Uinti', groupSize: 1, celebration: false, weakness: ['Uinti', 'Kestävyys'] }).pct, 50);
// Erikoisheikkoudet: bonus vain, kun kirjaaja merkitsee juuri viikon erikoisheikkouden
import { FAMILY_WEAKNESS, SPECIAL_WEAKNESSES, specialOf } from './rules.ts';
const sali = { minutes: 60, sportValue: 100, category: 'Voimailu' as const, sport: 'Sali', groupSize: 1, celebration: false };
for (const w of Object.keys(SPECIAL_WEAKNESSES)) {
  assert.equal(hitDamage({ ...sali, weakness: w, special: w }).pct, 50, w);
  assert.equal(hitDamage({ ...sali, weakness: w }).pct, 0, `${w} ilman merkintää`);
}
assert.equal(hitDamage({ ...sali, weakness: 'Urheilija on nainen', special: FAMILY_WEAKNESS }).pct, 0, 'väärä merkintä ei anna bonusta');
assert.equal(hitDamage({ ...sali, weakness: 'Uinti', special: FAMILY_WEAKNESS }).pct, 0, 'merkintä ei anna bonusta muulla viikolla');
assert.equal(specialOf(['Kestävyys', 'Urheilija on nainen']), 'Urheilija on nainen');
assert.equal(specialOf(['Kestävyys']), null);
// Uinti 30 min yksin = 100
assert.equal(hitDamage({ minutes: 30, sportValue: 200, category: 'Kestävyys', groupSize: 1, celebration: false, weakness: null }).damage, 100);
// Lupaukseen: 1 h uintia = 2 h, 2 h golfia = 1 h
assert.equal(pledgeHours(60, 200), 2);
assert.equal(pledgeHours(120, 50), 1);
// Sairaus: 4 h, 3 sairaspäivää → 2,5 h
assert.equal(adjustedPledge(4, 3), 2.5);
assert.equal(adjustedPledge(4, 7), 0);

// HP 45 tunnin lupauksilla
const hp = seasonHp(45);
assert.equal(hp.pace, 7250);
assert.equal(hp.monsters.length, 11);
assert.equal(hp.monsters[0], 5000); // viikko 1: 4/7 × 1,2 × vauhti (to–su)
assert.equal(seasonHp(38.5).monsters[0], 4500); // kauden lupauksilla (38,5 h, vauhti 6 600)
assert.equal(hp.monsters[1], 7500); // 1,05 × vauhti
assert.equal(hp.monsters[10], 8500); // 1,15 × vauhti
assert.equal(hp.boss, 11000);
// Pelkät lupaukset ja askeleet eivät riitä yhdenkään monsterin kaatamiseen viikossa
for (const m of hp.monsters.slice(1)) assert.ok(m > hp.pace);

// Kirjanpito
const users = ['a', 'b', 'c'];
const req = { 1: users, 2: users, 12: users };
const ev = (week: number, at: number, userId: string, damage: number, isTraining = true, allTogether = false) => ({ week, at, userId, damage, isTraining, allTogether });
const base = { monsterHp: Array(11).fill(1000), bossHp: 4000, requiredByWeek: req, pledgeBonusesByWeek: {} as Record<number, number> };

// 1) Monsteri kaatuu, ylijäämä ja lupausbonukset pottiin
let r = computeLedger({ ...base, pledgeBonusesByWeek: { 1: 2 }, events: [ev(1, 1, 'a', 600), ev(1, 2, 'b', 300), ev(1, 3, 'c', 400)] }, 1);
assert.equal(r.killed.length, 1);
assert.equal(r.pot, 300 + 200);

// 2) Sinetti puuttuu: padottu vahinko menetetään, monsteri jatkaa 1 HP:lla
r = computeLedger({ ...base, events: [ev(1, 1, 'a', 900), ev(1, 2, 'b', 400)] }, 1);
assert.equal(r.killed.length, 0);
assert.equal(r.alive[0].hp, 1);
assert.equal(r.lostToSeal, 300);

// 2b) Sama kesken viikon: padottu vahinko näkyy vielä, sinetistä puuttuu c
r = computeLedger({ ...base, events: [ev(1, 1, 'a', 900), ev(1, 2, 'b', 400)] }, 1, true);
assert.equal(r.alive[0].padded, 300);
assert.deepEqual(r.alive[0].hitters.sort(), ['a', 'b']);
assert.equal(r.lostToSeal, 0);

// 3) Rästi kaadetaan ensin, sitten viikon oma
r = computeLedger({ ...base, events: [ev(1, 1, 'a', 500), ev(2, 1, 'a', 100), ev(2, 2, 'b', 100), ev(2, 3, 'c', 1500)] }, 2);
assert.deepEqual(r.killed.map((k) => k.week), [1, 2]);
assert.equal(r.pot, 200);

// 4) Sinetti täyttyy pienellä iskulla, kun HP on jo nollassa
r = computeLedger({ ...base, events: [ev(1, 1, 'a', 1200), ev(1, 2, 'b', 10), ev(1, 3, 'c', 10)] }, 1);
assert.equal(r.killed.length, 1);
assert.equal(r.pot, 220);

// 5) Askeleet eivät täytä sinettiä
r = computeLedger({ ...base, events: [ev(1, 1, 'a', 900), ev(1, 2, 'b', 50, false), ev(1, 3, 'c', 200)] }, 1);
assert.equal(r.killed.length, 0);

// 6) Loppupomo: koko potti vähentää sen HP:ta (ei kattoa), kaatuu kuten muut: HP nollaan ja sinetti täyteen
const smallPot = [] as ReturnType<typeof ev>[];
for (let w = 1; w <= 11; w++) users.forEach((u, i) => smallPot.push(ev(w, i, u, u === 'c' ? 1100 : 10)));
r = computeLedger({ ...base, events: [...smallPot, ev(12, 1, 'a', 10), ev(12, 2, 'b', 10)] }, 12, true);
assert.equal(r.alive[0].hp, 4000 - 11 * 120 - 20, 'koko potti (11 × 120) vähennettiin');
const allKilled = [] as ReturnType<typeof ev>[];
for (let w = 1; w <= 11; w++) users.forEach((u, i) => allKilled.push(ev(w, i, u, u === 'c' ? 2000 : 10)));
r = computeLedger({ ...base, events: [...allKilled, ev(12, 1, 'a', 10), ev(12, 2, 'b', 10)] }, 12, true);
assert.equal(r.alive[0].padded, 11 * 1020 - 4000 + 20, 'potti suurempi kuin HP: ylijäämä odottaa sinettiä');
r = computeLedger({ ...base, events: [...allKilled, ev(12, 1, 'a', 2000), ev(12, 2, 'b', 10)] }, 12, true);
assert.equal(r.alive.length, 1, 'sinetistä puuttuu c');
r = computeLedger({ ...base, events: [...allKilled, ev(12, 1, 'a', 2000), ev(12, 2, 'b', 10), ev(12, 3, 'c', 10)] }, 12);
assert.equal(r.alive.length, 0, 'pomo kaatuu ilman yhteistreeniä');

// Tietokannan lajilista (migraatio 023, taulu sports) sisältää sovelluksen lajit samoilla arvoilla ja ryhmillä
import { SPORTS } from './rules.ts';
const sql = readFileSync(new URL('../supabase/migrations/023_lajit.sql', import.meta.url), 'utf8');
for (const sp of SPORTS) {
  assert.ok(sql.includes(`('${sp.name}', ${sp.value}, '${sp.category}')`), `${sp.name} puuttuu tietokannan lajilistasta arvolla ${sp.value}`);
}
assert.equal(new Set(SPORTS.map((s) => s.name)).size, SPORTS.length, 'lajin nimi on listalla kahdesti');

// Portinvartija: HP 1 500, ei sinettiä; ylijäämä pottiin, vajaus viikon 1 monsterille
import { gateResult } from './gate.ts';
const gh = [{ trained_on: '2026-09-29', damage: 700 }, { trained_on: '2026-09-30', damage: 500 }, { trained_on: '2026-10-01', damage: 999 }, { trained_on: '2026-09-28', damage: 999 }];
const gs = [{ day: '2026-09-30' }, { day: '2026-09-30' }, { day: '2026-10-01' }];
const g1 = gateResult(null, gh, gs);
assert.deepEqual([g1.hp, g1.dealt, g1.left, g1.surplus, g1.killed], [1500, 1300, 200, 0, false]);
const g2 = gateResult({ name: 'Vartija', description: null, image_path: null, taunt: null, hp: 1000 }, gh, gs);
assert.deepEqual([g2.name, g2.left, g2.surplus, g2.killed], ['Vartija', 0, 300, true]);
// Kirjanpito: aloituspotti vähentää loppupomoa kuten muu potti
r = computeLedger({ ...base, startPot: 500, events: [...smallPot, ev(12, 1, 'a', 10), ev(12, 2, 'b', 10)] }, 12, true);
assert.equal(r.alive[0].hp, 4000 - 11 * 120 - 500 - 20, 'portinvartijan ylijäämä iskee loppupomoon');

console.log('Kaikki sääntötestit menivät läpi.');

// Sinettiraja: HP ei näy nollana, kun sinetistä puuttuu sankareita
import { sealView } from './rules.ts';
assert.deepEqual(sealView({ hp: 1, padded: 300, hitters: ['a'] }, ['a', 'b', 'c']), { hp: 20, dam: 320, missing: 2, floor: 20 });
assert.deepEqual(sealView({ hp: 500, padded: 0, hitters: [] }, ['a', 'b']), { hp: 500, dam: 0, missing: 2, floor: 20 });
assert.deepEqual(sealView({ hp: 15, padded: 0, hitters: [] }, ['a', 'b']), { hp: 20, dam: 5, missing: 2, floor: 20 });
assert.equal(sealView({ hp: 1, padded: 0, hitters: ['a'] }, ['a', 'b']).hp, 10, 'sunnuntain jälkeen rästi näkyy sinettirajalla');
console.log('Sinettirajatestit menivät läpi.');

// Bonusten erittely lokiin tallennetusta iskusta
import { hitBonusLabels } from './rules.ts';
const lbl = (h: Parameters<typeof hitBonusLabels>[0]) => hitBonusLabels(h).map((b) => `${b.label} ${b.pct}`);
assert.deepEqual(lbl({ bonus_pct: 0, all_together: false, companions: [], weakness_hit: false }), []);
assert.deepEqual(lbl({ bonus_pct: 100, all_together: false, companions: ['a', 'b'], weakness_hit: true }), ['Yhdessä 50', 'Heikkous 50']);
assert.deepEqual(lbl({ bonus_pct: 200, all_together: true, companions: ['a', 'b'], weakness_hit: true }), ['Koko porukka 100', 'Heikkous 50', 'Juhlapäivä 50']);
assert.deepEqual(lbl({ bonus_pct: 50, all_together: false, companions: ['a'], weakness_hit: false }), ['Juhlapäivä 50'], 'kaksin ei ole yhdessä-bonusta');
assert.deepEqual(lbl({ bonus_pct: 50, all_together: false, companions: [] }), ['Heikkous tai juhlapäivä 50'], 'ilman heikkoustietoa');
console.log('Bonuserittelytestit menivät läpi.');

// Ensi-iskun erittely
import { potParts } from './rules.ts';
assert.deepEqual(potParts(2075, 400, 2), [{ label: 'Ylijäämävoima', value: 1475 }, { label: 'Lupaukset', value: 200 }, { label: 'Portinvartija', value: 400 }]);
assert.deepEqual(potParts(300, 0, 3), [{ label: 'Lupaukset', value: 300 }], 'pelkät lupaukset');
assert.deepEqual(potParts(0, 0, 0), []);
console.log('Ensi-iskutestit menivät läpi.');

// HP:n realismi
import { hpPlan, weekActual } from './hpcheck.ts';
{
  const plan = hpPlan(40, [4500, 7000], {}, []);
  assert.deepEqual([plan[0].pledgeBase, plan[0].stepsEst, plan[1].pledgeBase, plan[1].stepsEst], [2286, 1571, 4000, 2750], 'viikko 1 on 4/7');
  assert.deepEqual([plan[1].need, plan[1].needPct, plan[1].needPctAtPace], [250, 6, null]);
  const a = weekActual([{ damage: 150, bonus_pct: 50 }, { damage: 100, bonus_pct: 0 }], 10, 1, 50, 250);
  assert.deepEqual(a, { trainingBase: 200, bonus: 50, steps: 750 });
  // Toteutunut tahti: treenit puolet lupauksista ja askeleet puolet arviosta
  const half = hpPlan(40, [4500, 7000], { 1: { trainingBase: 1143, bonus: 0, steps: 786 } }, [1]);
  assert.equal(half[1].needPctAtPace, Math.round(((7000 - 2000.25 - 1375.3) / 2000.25) * 100));
}
console.log('HP-realismitestit menivät läpi.');
