// Aja: node --experimental-strip-types lib/weekly.test.ts
import assert from 'node:assert/strict';
import { isSickOn, sickDaysBetween, weekPledgeTarget, pledgeForWeek, patrolDays, requiredForSeal, daysInWeek } from './weekly.ts';

const sick = [{ user_id: 'a', starts_on: '2026-10-13', ends_on: '2026-10-15' }, { user_id: 'b', starts_on: '2026-10-18', ends_on: null }];
assert.equal(isSickOn(sick, 'a', '2026-10-12'), false);
assert.equal(isSickOn(sick, 'a', '2026-10-13'), true);
assert.equal(isSickOn(sick, 'a', '2026-10-16'), false);
assert.equal(isSickOn(sick, 'b', '2026-11-30'), true);
assert.equal(sickDaysBetween(sick, 'a', '2026-10-12', '2026-10-18'), 3);

assert.equal(daysInWeek(1), 4);
assert.equal(daysInWeek(2), 7);
// 4 h, 3 sairaspäivää → 2,5 h (sama kuin adjustedPledge)
assert.equal(weekPledgeTarget(4, 2, 3), 2.5);
// Viikko 1: to–su 4 päivää → 4 × 4/7 = 2,29 → 2,5 h
assert.equal(weekPledgeTarget(4, 1, 0), 2.5);
assert.equal(weekPledgeTarget(4, 2, 7), 0);

assert.equal(pledgeForWeek(4, [], 5), 4);
assert.equal(pledgeForWeek(4, [{ from_week: 3, hours: 5 }, { from_week: 6, hours: 3 }], 5), 5);
assert.equal(pledgeForWeek(4, [{ from_week: 3, hours: 5 }, { from_week: 6, hours: 3 }], 6), 3);
assert.equal(pledgeForWeek(4, [{ from_week: 3, hours: 5 }], 2), 4);

// Partio: a, b, c; b kipeä 18.10. alkaen
const steps = [
  { user_id: 'a', day: '2026-10-12', created_at: '2026-10-12T08:00:00Z' },
  { user_id: 'b', day: '2026-10-12', created_at: '2026-10-12T09:00:00Z' },
  { user_id: 'c', day: '2026-10-12', created_at: '2026-10-12T20:00:00Z' },
  { user_id: 'a', day: '2026-10-13', created_at: '2026-10-13T08:00:00Z' },
  { user_id: 'a', day: '2026-10-18', created_at: '2026-10-18T08:00:00Z' },
  { user_id: 'c', day: '2026-10-18', created_at: '2026-10-18T10:00:00Z' },
];
const periods = [{ user_id: 'b', starts_on: '2026-10-18', ends_on: null }];
assert.deepEqual(patrolDays(steps, ['a', 'b', 'c'], periods), [
  { day: '2026-10-12', at: '2026-10-12T20:00:00Z' },
  { day: '2026-10-18', at: '2026-10-18T10:00:00Z' },
]);

// Sinetti: b kipeänä viikolla 3 (12.–18.10.) → ei vaadita
assert.deepEqual(requiredForSeal(['a', 'b', 'c'], periods, 3, '2026-10-18'), ['a', 'c']);
// Kesken viikon (ennen sairastumista) b vaaditaan vielä
assert.deepEqual(requiredForSeal(['a', 'b', 'c'], periods, 3, '2026-10-14'), ['a', 'b', 'c']);

console.log('Kaikki viikkotestit menivät läpi.');

import { activeWeaknesses, partHps, partStates, weaknessesOf } from './trio.ts';
assert.deepEqual(partHps(5000, 3), [1666, 1666, 1668]);
// 2 000 vahinkoa 5 000 HP:n kolmikkoon: ensimmäinen kaatunut, toinen osin
assert.deepEqual(partStates(5000, 3000, 3, false).map((p) => [p.left, p.dead]), [[0, true], [1332, false], [1668, false]]);
// HP 0 mutta sinetti kesken: viimeinen ei vielä kaadu
assert.deepEqual(partStates(5000, 0, 3, false).map((p) => p.dead), [true, true, false]);
assert.deepEqual(partStates(5000, 0, 3, true).map((p) => p.dead), [true, true, true]);
assert.deepEqual(weaknessesOf({ parts: [{ name: 'a', weakness: 'Voimailu' }, { name: 'b', weakness: 'Voimailu' }, { name: 'c', weakness: 'Muu' }] }), ['Voimailu', 'Muu']);
// Kaksikko: 7 500 HP → 2 × 3 750; 4 000 vahinkoa → ensimmäinen kaatunut, toisesta 250 pois
assert.deepEqual(partHps(7500, 2), [3750, 3750]);
assert.deepEqual(partStates(7500, 3500, 2, false).map((p) => [p.left, p.dead]), [[0, true], [3500, false]]);
// Heikkous on osakohtainen: bonus vain vuorossa olevan osan heikkoudesta
const trio = { hp: 8400, parts: [{ name: 'Zom', weakness: 'Crossfit' }, { name: 'Zam', weakness: 'HIIT' }, { name: 'Zom Zam', weakness: 'Padel' }] };
assert.deepEqual(activeWeaknesses(trio, 8400), ['Crossfit']);
assert.deepEqual(activeWeaknesses(trio, 5600), ['HIIT']);
assert.deepEqual(activeWeaknesses(trio, 100), ['Padel']);
assert.deepEqual(activeWeaknesses(trio, 0), ['Padel']);
assert.deepEqual(activeWeaknesses({ hp: 5000, weakness: 'Uinti' }, 100), ['Uinti']);
console.log('Kolmikko- ja kaksikkotestit menivät läpi.');
