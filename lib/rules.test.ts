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
assert.equal(hp.monsters[0], 8500); // Willa 1,2 × vauhti
assert.equal(hp.monsters[1], 7500); // 1,05 × vauhti
assert.equal(hp.monsters[10], 8500); // 1,15 × vauhti
assert.equal(hp.boss, 11000);
assert.equal(hp.potCap, 5500);
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

// 6) Loppupomo: potti vähentää (katto puolet), kaatuu kuten muut: HP nollaan ja sinetti täyteen
const allKilled = [] as ReturnType<typeof ev>[];
for (let w = 1; w <= 11; w++) users.forEach((u, i) => allKilled.push(ev(w, i, u, u === 'c' ? 2000 : 10)));
r = computeLedger({ ...base, events: [...allKilled, ev(12, 1, 'a', 10), ev(12, 2, 'b', 10)] }, 12, true);
assert.equal(r.alive[0].hp, 2000 - 20, 'potti vähensi puolet 4 000 HP:sta');
r = computeLedger({ ...base, events: [...allKilled, ev(12, 1, 'a', 2000), ev(12, 2, 'b', 10)] }, 12, true);
assert.equal(r.alive.length, 1, 'sinetistä puuttuu c');
r = computeLedger({ ...base, events: [...allKilled, ev(12, 1, 'a', 2000), ev(12, 2, 'b', 10), ev(12, 3, 'c', 10)] }, 12);
assert.equal(r.alive.length, 0, 'pomo kaatuu ilman yhteistreeniä');

// Tietokannan lajilista (migraatio 007, sport_value) vastaa sovelluksen lajeja ja arvoja
import { SPORTS } from './rules.ts';
const sql = readFileSync(new URL('../supabase/migrations/007_tarkistukset.sql', import.meta.url), 'utf8');
const block = (v: number) => sql.split('\n').join(' ').match(new RegExp(`(?:in \\(([^)]*)\\)|= '([^']*)') then ${v}`))!;
for (const sp of SPORTS) {
  const m = block(sp.value);
  assert.ok((m[1] ?? `'${m[2]}'`).includes(`'${sp.name}'`), `${sp.name} puuttuu tietokannan lajilistasta arvolla ${sp.value}`);
}

console.log('Kaikki sääntötestit menivät läpi.');

// Sinettiraja: HP ei näy nollana, kun sinetistä puuttuu sankareita
import { sealView } from './rules.ts';
assert.deepEqual(sealView({ hp: 1, padded: 300, hitters: ['a'] }, ['a', 'b', 'c']), { hp: 20, dam: 320, missing: 2, floor: 20 });
assert.deepEqual(sealView({ hp: 500, padded: 0, hitters: [] }, ['a', 'b']), { hp: 500, dam: 0, missing: 2, floor: 20 });
assert.deepEqual(sealView({ hp: 15, padded: 0, hitters: [] }, ['a', 'b']), { hp: 20, dam: 5, missing: 2, floor: 20 });
assert.equal(sealView({ hp: 1, padded: 0, hitters: ['a'] }, ['a', 'b']).hp, 10, 'sunnuntain jälkeen rästi näkyy sinettirajalla');
console.log('Sinettirajatestit menivät läpi.');
