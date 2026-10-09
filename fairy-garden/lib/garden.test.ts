import assert from 'node:assert/strict';
import { points, stageFor, helsinkiDay, isDay } from './garden.ts';

assert.equal(points(12_345, 25), 14);
assert.equal(stageFor(0).stage.name, 'Siemen');
assert.equal(stageFor(10).stage.name, 'Itu');
assert.equal(stageFor(99).stage.name, 'Silmu');
assert.equal(stageFor(500).stage.name, 'Keijukuningatar');
assert.equal(stageFor(500).pct, 100);
assert.equal(helsinkiDay(new Date('2026-11-28T22:30:00Z')), '2026-11-29');
assert.ok(isDay('2026-10-09'));
assert.ok(!isDay('9.10.2026'));
console.log('garden: ok');
