import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAP_STYLE, decodePolyline, directionUrl, distanceMatrixUrl, formatDuration,
  matrixKey, parseDirection, parseDistanceMatrix, roadDistanceFn, routeKey, styleUrl,
} from '../../src/maps.js';

/* Goong answers get drawn on a map and fed into the route optimiser, so these
   parsers are a trust boundary rather than glue — same footing as places.js. */

/* ── the basemap style ──────────────────────────────────────────────────── */

test('a style name outside the hosted set falls back instead of 404ing', () => {
  const url = new URL(styleUrl('goong_map_dark', 'k'));
  assert.equal(url.pathname, '/assets/goong_map_dark.json');

  // a typo in the env var must not leave a blank canvas
  assert.equal(new URL(styleUrl('goong_dark', 'k')).pathname, `/assets/${DEFAULT_MAP_STYLE}.json`);
  assert.equal(new URL(styleUrl('', 'k')).pathname, `/assets/${DEFAULT_MAP_STYLE}.json`);
  assert.equal(new URL(styleUrl(undefined, 'k')).pathname, `/assets/${DEFAULT_MAP_STYLE}.json`);
});

test('a style name cannot escape the assets path', () => {
  // MAP_STYLES is a list, not a pattern, so "../" is simply not one of them
  assert.equal(new URL(styleUrl('../../admin', 'k')).pathname, `/assets/${DEFAULT_MAP_STYLE}.json`);
});

test('the maptiles key is escaped into the query string', () => {
  const url = new URL(styleUrl(DEFAULT_MAP_STYLE, 'abc+def/123'));
  assert.equal(url.searchParams.get('api_key'), 'abc+def/123');
});

/* ── building the requests ──────────────────────────────────────────────── */

const stops = [
  { lat: 16.0678, lng: 108.2208 },
  { lat: 16.0611, lng: 108.2467 },
  { lat: 15.8801, lng: 108.3380 },
];

test('a whole day is one Direction call: first stop out, the rest joined by ;', () => {
  const url = new URL(directionUrl(stops, 'key-1'));
  assert.equal(url.origin + url.pathname, 'https://rsapi.goong.io/Direction');
  assert.equal(url.searchParams.get('origin'), '16.0678,108.2208');
  assert.equal(url.searchParams.get('destination'), '16.0611,108.2467;15.8801,108.338');
  assert.equal(url.searchParams.get('vehicle'), 'car');
  assert.equal(url.searchParams.get('api_key'), 'key-1');
});

test('the distance matrix asks for every pair in one call', () => {
  const url = new URL(distanceMatrixUrl(stops, stops, 'key-1'));
  assert.equal(url.origin + url.pathname, 'https://rsapi.goong.io/DistanceMatrix');
  assert.equal(url.searchParams.get('origins'), '16.0678,108.2208|16.0611,108.2467|15.8801,108.338');
  assert.equal(url.searchParams.get('origins'), url.searchParams.get('destinations'));
});

/* ── what counts as the same question ───────────────────────────────────── */

/* These two decide how much of Goong's 1000-a-day allowance the app spends,
   so "same key" and "same answer" have to mean the same thing. */

test('a route key follows the order, because the road does', () => {
  const flipped = [stops[1], stops[0], stops[2]];
  assert.notEqual(routeKey(stops), routeKey(flipped));
  assert.equal(routeKey(stops), routeKey(stops.map((s) => ({ ...s }))));
});

test('a matrix key ignores the order, because the matrix does', () => {
  const flipped = [stops[2], stops[0], stops[1]];
  assert.equal(matrixKey(stops), matrixKey(flipped));
});

test('editing anything but the coordinates is the same question', () => {
  // a note typed letter by letter must not become a request per letter
  const edited = stops.map((s, i) => ({ ...s, note: 'đặt bàn trước', cost: 1000 * i, time: '08:30' }));
  assert.equal(routeKey(edited), routeKey(stops));
  assert.equal(matrixKey(edited), matrixKey(stops));
});

test('a stop with no coordinates is not part of either key', () => {
  const withGhost = [...stops, { lat: null, lng: null, name: 'chưa ghim' }];
  assert.equal(routeKey(withGhost), routeKey(stops));
  assert.equal(matrixKey(withGhost), matrixKey(stops));
});

test('the keys survive junk instead of a list', () => {
  for (const junk of [null, undefined, 'nope', 42, {}]) {
    assert.equal(routeKey(junk), '');
    assert.equal(matrixKey(junk), '');
  }
});

/* ── the encoded polyline ───────────────────────────────────────────────── */

test('the polyline decoder agrees with the format it is named after', () => {
  // the canonical example from Google's encoded-polyline spec
  const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.deepEqual(pts, [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
});

test('a truncated line keeps whatever decoded rather than throwing', () => {
  const whole = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  const cut = decodePolyline(whole.slice(0, whole.length - 3));
  assert.ok(cut.length >= 1 && cut.length < 3);
  assert.deepEqual(cut[0], [38.5, -120.2]);
});

test('garbage in gives an empty line, not an exception or a wrong one', () => {
  assert.deepEqual(decodePolyline(''), []);
  assert.deepEqual(decodePolyline(null), []);
  assert.deepEqual(decodePolyline(undefined), []);
  assert.deepEqual(decodePolyline(42), []);
  assert.deepEqual(decodePolyline('   '), []);          // below the 63 offset
  // every point that survives is a point that could exist
  for (const [lat, lng] of decodePolyline('~~~~~~~~~~~~~~~~~~~~')) {
    assert.ok(Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
  }
});

/* ── reading Direction ──────────────────────────────────────────────────── */

const direction = (legs) => ({
  routes: [{
    legs,
    overview_polyline: { points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
  }],
});

const leg = (m, s) => ({ distance: { text: `${m} m`, value: m }, duration: { text: `${s} s`, value: s } });

test('a route comes back as a line plus the day on the road', () => {
  const out = parseDirection(direction([leg(4200, 600), leg(1800, 300)]));
  assert.equal(out.path.length, 3);
  assert.equal(out.km, 6);
  assert.equal(out.minutes, 15);
});

test('a total that did not add up is withheld, but the line is still drawn', () => {
  const missing = parseDirection(direction([leg(4200, 600), { distance: {}, duration: {} }]));
  assert.equal(missing.km, null);
  assert.equal(missing.minutes, null);
  assert.equal(missing.path.length, 3);

  // no legs at all is the same story
  assert.equal(parseDirection(direction([])).km, null);
});

test('a negative distance is a field that is not what it claims to be', () => {
  assert.equal(parseDirection(direction([leg(-5, 10)])).km, null);
});

test('an answer with no usable line is no answer', () => {
  assert.equal(parseDirection({ routes: [] }), null);
  assert.equal(parseDirection({ routes: [{ overview_polyline: { points: '' }, legs: [] }] }), null);
  assert.equal(parseDirection({}), null);
  assert.equal(parseDirection(null), null);
  assert.equal(parseDirection('nope'), null);
});

/* ── reading DistanceMatrix ─────────────────────────────────────────────── */

const cell = (m) => ({ status: 'OK', distance: { value: m }, duration: { value: m / 10 } });

const matrixJson = {
  rows: [
    { elements: [cell(0), cell(3000), cell(30000)] },
    { elements: [cell(3000), cell(0), cell(28000)] },
    { elements: [cell(30000), cell(28000), cell(0)] },
  ],
};

test('a matrix is read as metres, per pair', () => {
  const m = parseDistanceMatrix(matrixJson, 3, 3);
  assert.equal(m[0][2], 30000);
  assert.equal(m[2][1], 28000);
});

test('a matrix of the wrong size is refused rather than indexed', () => {
  assert.equal(parseDistanceMatrix(matrixJson, 4, 3), null);
  assert.equal(parseDistanceMatrix(matrixJson, 3, 2), null);
  assert.equal(parseDistanceMatrix({ rows: [] }, 3, 3), null);
  assert.equal(parseDistanceMatrix({}, 1, 1), null);
  assert.equal(parseDistanceMatrix(null, 1, 1), null);
});

test('a cell Goong could not answer for is null, not zero', () => {
  const m = parseDistanceMatrix({
    rows: [{ elements: [cell(0), { status: 'ZERO_RESULTS' }, { distance: {} }] }],
  }, 1, 3);
  assert.equal(m[0][0], 0);      // zero metres to itself is a real answer
  assert.equal(m[0][1], null);   // "no route" is not zero metres
  assert.equal(m[0][2], null);
});

/* ── feeding the optimiser ──────────────────────────────────────────────── */

test('the matrix becomes kilometres the optimiser can call synchronously', () => {
  const distance = roadDistanceFn(stops, parseDistanceMatrix(matrixJson, 3, 3));
  assert.equal(distance(stops[0], stops[1]), 3);
  assert.equal(distance(stops[0], stops[2]), 30);
});

test('a pair with no road number falls back to the straight line, not to zero', () => {
  const matrix = [[0, null], [null, 0]];
  const two = stops.slice(0, 2);
  const distance = roadDistanceFn(two, matrix, () => 42);
  assert.equal(distance(two[0], two[1]), 42);
});

test('a stop that was never in the matrix falls back too', () => {
  const distance = roadDistanceFn(stops, parseDistanceMatrix(matrixJson, 3, 3), () => 7);
  assert.equal(distance(stops[0], { lat: 21.03, lng: 105.85 }), 7);
});

/* ── the number under the day title ─────────────────────────────────────── */

test('driving time reads the way a person says it', () => {
  assert.equal(formatDuration(0), 'dưới 1 phút');
  assert.equal(formatDuration(0.4), 'dưới 1 phút');
  assert.equal(formatDuration(45), '45 phút');
  assert.equal(formatDuration(60), '1 giờ');
  assert.equal(formatDuration(80), '1 giờ 20 phút');
  assert.equal(formatDuration(null), 'dưới 1 phút');
});
