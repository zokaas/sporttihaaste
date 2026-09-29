// Aja: node --experimental-strip-types lib/season.test.ts
import assert from 'node:assert/strict';
import { seasonWeek, weekRange, loggableDays, formatDay, helsinkiToday } from './season.ts';

assert.equal(seasonWeek('2026-09-30'), 0);
assert.equal(seasonWeek('2026-10-01'), 1);
assert.equal(seasonWeek('2026-10-04'), 1);
assert.equal(seasonWeek('2026-10-05'), 2);
assert.equal(seasonWeek('2026-10-11'), 2);
assert.equal(seasonWeek('2026-10-12'), 3);
assert.equal(seasonWeek('2026-12-13'), 11);
assert.equal(seasonWeek('2026-12-14'), 12);
assert.equal(seasonWeek('2026-12-20'), 12);
assert.equal(seasonWeek('2026-12-21'), 13);
assert.deepEqual(weekRange(1), { start: '2026-10-01', end: '2026-10-04' });
assert.deepEqual(weekRange(2), { start: '2026-10-05', end: '2026-10-11' });
assert.deepEqual(weekRange(11), { start: '2026-12-07', end: '2026-12-13' });
assert.deepEqual(weekRange(12), { start: '2026-12-14', end: '2026-12-20' });
assert.deepEqual(loggableDays('2026-10-14'), ['2026-10-12', '2026-10-13', '2026-10-14']);
assert.equal(loggableDays('2026-10-03').length, 3);
assert.deepEqual(loggableDays('2026-09-29'), []);
// Portinvartijan päivä: vain se päivä, viikko 0
assert.deepEqual(loggableDays('2026-09-30'), ['2026-09-30']);
assert.equal(seasonWeek('2026-09-30'), 0);
assert.deepEqual(weekRange(0), { start: '2026-09-30', end: '2026-09-30' });
assert.equal(formatDay('2026-10-01'), 'to 1.10.');
// Klo 23.30 UTC 30.9. on jo 1.10. Suomessa
assert.equal(helsinkiToday(new Date('2026-09-30T23:30:00Z')), '2026-10-01');

console.log('Kaikki kalenteritestit menivät läpi.');

import { helsinkiMs } from './season.ts';
// Kesäaika (lokakuun alku) ja talviaika (joulukuu)
assert.equal(new Date(helsinkiMs('2026-10-04')).toISOString(), '2026-10-04T20:59:59.000Z');
assert.equal(new Date(helsinkiMs('2026-12-20')).toISOString(), '2026-12-20T21:59:59.000Z');
console.log('Aikavyöhyketestit menivät läpi.');
