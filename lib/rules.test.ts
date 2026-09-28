// Aja: node --experimental-strip-types lib/rules.test.ts
import assert from 'node:assert/strict';
import { hitDamage, adjustedPledge, seasonHp, computeLedger, pledgeHours } from './rules.ts';

// Vahinko: 1 h salia kolmestaan, heikkous voimailu → 200
assert.equal(hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 3, celebration: false, weakness: 'Voimailu' }).damage, 200);
// Kaikki bonukset: katto +200 %
assert.equal(hitDamage({ minutes: 60, sportValue: 100, category: 'Voimailu', groupSize: 10, celebration: true, weakness: 'Voimailu' }).damage, 300);
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
assert.equal(hp.pace, 8150);
assert.equal(hp.monsters[0], 10000);
assert.equal(hp.monsters[9], 8000);
assert.equal(hp.boss, 12000);
assert.equal(hp.potCap, 6000);

// Kirjanpito
const users = ['a', 'b', 'c'];
const req = { 1: users, 2: users, 11: users };
const ev = (week: number, at: number, userId: string, damage: number, isTraining = true, allTogether = false) => ({ week, at, userId, damage, isTraining, allTogether });
const base = { monsterHp: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000], bossHp: 4000, requiredByWeek: req, pledgeBonusesByWeek: {} as Record<number, number> };

// 1) Monsteri kaatuu, ylijäämä ja lupausbonukset pottiin
let r = computeLedger({ ...base, pledgeBonusesByWeek: { 1: 2 }, events: [ev(1, 1, 'a', 600), ev(1, 2, 'b', 300), ev(1, 3, 'c', 400)] }, 1);
assert.equal(r.killed.length, 1);
assert.equal(r.pot, 300 + 200);

// 2) Sinetti puuttuu: padottu vahinko menetetään, monsteri jatkaa 1 HP:lla
r = computeLedger({ ...base, events: [ev(1, 1, 'a', 900), ev(1, 2, 'b', 400)] }, 1);
assert.equal(r.killed.length, 0);
assert.equal(r.alive[0].hp, 1);
assert.equal(r.lostToSeal, 300);

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

// 6) Loppupomo: potti vähentää, katto puolet, viimeinen isku yhdessä
const allKilled = [] as ReturnType<typeof ev>[];
for (let w = 1; w <= 10; w++) users.forEach((u, i) => allKilled.push(ev(w, i, u, u === 'c' ? 2000 : 10)));
r = computeLedger({ ...base, events: [...allKilled, ev(11, 1, 'a', 10), ev(11, 2, 'b', 10), ev(11, 3, 'c', 5000)] }, 11);
assert.equal(r.alive.length, 1, 'pomo ei kaadu ilman yhteistreeniä');
r = computeLedger({ ...base, events: [...allKilled, ev(11, 1, 'a', 10), ev(11, 2, 'b', 10), ev(11, 3, 'c', 5000, true, true)] }, 11);
assert.equal(r.alive.length, 0);

console.log('Kaikki sääntötestit menivät läpi.');
