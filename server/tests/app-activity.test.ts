// The app's GPS helpers (lib/activity.ts) must speak the server's route format.
import assert from 'node:assert/strict';
import { it } from 'vitest';
import * as server from '../src/lib/polyline.js';
import { SPEED_LIMITS as SERVER_LIMITS } from '../src/modules/activities/speed.js';
import {
  decodeRoute,
  encodeRoute,
  formatDuration,
  formatKm,
  formatPace,
  metersBetween,
  paceFromSpeed,
  recentSpeed,
  trimEnds,
  privacyTrim,
  SPEED_LIMITS,
  type TrackPoint,
} from '../../lib/activity';

it('app route helpers match the server', () => {
// A 1 km straight line, one fix every 10 m, at 5:00 per km (3.33 m/s → 3 s per fix).
const track: TrackPoint[] = Array.from({ length: 101 }, (_, i) => [-6.9 + i * 0.00009, 107.6, i * 3000]);

// The app's encoding is the server's encoding, both ways.
const app = encodeRoute(track);
assert.equal(app, server.encode(track.map(([a, b]) => [a, b])));
assert.deepEqual(decodeRoute(app), server.decode(app));
assert.equal(decodeRoute(app).length, 101);

// Every fix is kept (repeats too), so point i always lines up with time i.
assert.equal(decodeRoute(encodeRoute([track[0]!, track[0]!, track[1]!])).length, 3);

let meters = 0;
for (let i = 1; i < track.length; i++) meters += metersBetween(track[i - 1]!, track[i]!);
assert.ok(Math.abs(meters - 1000) < 15, `1 km line measured ${meters}`);

const speed = recentSpeed(track)!;
assert.ok(Math.abs(speed - 10 / 3) < 0.1, `speed ${speed}`);
assert.equal(formatPace(paceFromSpeed(speed)), '5:00');
assert.equal(recentSpeed(track.slice(0, 1)), null);

assert.equal(formatKm(1234), '1.23');
assert.equal(formatDuration(59), '0:59');
assert.equal(formatDuration(3725), '1:02:05');
assert.equal(formatPace(null), '–');

// Share cards trim the route ends exactly like the public page.
const line = track.map(([a, b]) => [a, b] as [number, number]);
assert.deepEqual(trimEnds(line), server.trimEnds(line, 200));
assert.deepEqual(trimEnds(line.slice(0, 30)), []);
assert.deepEqual(privacyTrim(line.slice(0, 36)), server.privacyTrim(line.slice(0, 36)));
assert.deepEqual(SPEED_LIMITS, SERVER_LIMITS);

});
