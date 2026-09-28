// Aja: node --experimental-strip-types lib/weekly.test.ts
import assert from 'node:assert/strict';
import { isSickOn, sickDaysBetween, weekPledgeTarget, pledgeForWeek, patrolDays, requiredForSeal, daysInWeek } from './weekly.ts';

const sick = [{ user_id: 'a', starts_on: '2026-10-13', ends_on: '2026-10-15' }, { user_id: 'b', starts_on: '2026-10-18', ends_on: null }];
assert.equal(isSickOn(sick, 'a', '2026-10-12'), false);
assert.equal(isSickOn(sick, 'a', '2026-10-13'), true);
assert.equal(isSickOn(sick, 'a', '2026-10-16'), false);
assert.equal(isSickOn(sick, 'b', '2026-11-30'), true);
assert.equal(sickDaysBetween(sick, 'a', '2026-10-12', '2026-10-18'), 3);

assert.equal(daysInWeek(1), 11);
assert.equal(daysInWeek(2), 7);
// 4 h, 3 sairaspäivää → 2,5 h (sama kuin adjustedPledge)
assert.equal(weekPledgeTarget(4, 2, 3), 2.5);
// Viikko 1: 11 päivää → 4 × 11/7 = 6,29 → 6,5 h
assert.equal(weekPledgeTarget(4, 1, 0), 6.5);
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

// Sinetti: b kipeänä viikolla 2 → ei vaadita
assert.deepEqual(requiredForSeal(['a', 'b', 'c'], periods, 2, '2026-10-18'), ['a', 'c']);
// Kesken viikon (ennen sairastumista) b vaaditaan vielä
assert.deepEqual(requiredForSeal(['a', 'b', 'c'], periods, 2, '2026-10-14'), ['a', 'b', 'c']);

console.log('Kaikki viikkotestit menivät läpi.');
