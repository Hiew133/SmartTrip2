import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLACE_LIMIT, goongUrl, isSearchable, nominatimUrl, parseGoong, parseNominatim,
} from '../../src/places.js';

/* A geocoder is a third party whose JSON lands in trip data and then on a map,
   so the parsers are treated as a trust boundary, not as glue. */

test('a query has to be worth a request', () => {
  assert.equal(isSearchable('Hộ'), false);
  assert.equal(isSearchable('   '), false);
  assert.equal(isSearchable(null), false);
  assert.equal(isSearchable('Hội An'), true);
  assert.equal(isSearchable('  Bà Nà  '), true);
});

test('the query is encoded, not concatenated', () => {
  const url = new URL(nominatimUrl('Bún chả cá Hờn & bánh mì'));
  assert.equal(url.origin + url.pathname, 'https://nominatim.openstreetmap.org/search');
  assert.equal(url.searchParams.get('q'), 'Bún chả cá Hờn & bánh mì');
  assert.equal(url.searchParams.get('limit'), String(PLACE_LIMIT));
  assert.equal(url.searchParams.get('accept-language'), 'vi');
});

test('the Goong key rides in the query string, escaped', () => {
  const url = new URL(goongUrl('Chợ Hàn', 'abc+def/123'));
  assert.equal(url.searchParams.get('api_key'), 'abc+def/123');
  assert.equal(url.searchParams.get('address'), 'Chợ Hàn');
});

/* ── Nominatim ──────────────────────────────────────────────────────────── */

const nominatim = [
  {
    place_id: 123,
    lat: '16.0611',
    lon: '108.2467',
    name: 'Biển Mỹ Khê',
    display_name: 'Biển Mỹ Khê, Phước Mỹ, Sơn Trà, Đà Nẵng, Việt Nam',
  },
  {
    place_id: 456,
    lat: '15.8801',
    lon: '108.3380',
    name: '',
    display_name: 'Phố cổ Hội An, Quảng Nam, Việt Nam',
  },
];

test('a Nominatim result splits into a name and the address under it', () => {
  const out = parseNominatim(nominatim);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    id: '123',
    name: 'Biển Mỹ Khê',
    address: 'Phước Mỹ, Sơn Trà, Đà Nẵng, Việt Nam',
    lat: 16.0611,
    lng: 108.2467,
  });
  assert.equal(out[1].name, 'Phố cổ Hội An', 'thiếu name thì lấy đoạn đầu của display_name');
  assert.equal(out[1].address, 'Quảng Nam, Việt Nam');
});

test('coordinates arrive as strings and come out as numbers', () => {
  const [r] = parseNominatim(nominatim);
  assert.equal(typeof r.lat, 'number');
  assert.equal(typeof r.lng, 'number');
});

test('a result that cannot be mapped or named is dropped, not shown empty', () => {
  const out = parseNominatim([
    { place_id: 1, lat: 'không phải số', lon: '108', display_name: 'Ở đâu đó' },
    { place_id: 2, lat: '16', lon: null, display_name: 'Thiếu kinh độ' },
    { place_id: 3, lat: '16', lon: '108', display_name: '' },
    { place_id: 4, lat: '91', lon: '108', display_name: 'Ngoài quả đất' },
    null,
    'chuỗi lạ',
    { place_id: 5, lat: '16.05', lon: '108.22', display_name: 'Đà Nẵng' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Đà Nẵng');
});

test('a null coordinate never becomes (0,0)', () => {
  const out = parseNominatim([{ place_id: 1, lat: null, lon: null, display_name: 'Không toạ độ' }]);
  assert.deepEqual(out, []);
});

test('junk instead of an array is an empty result, not a crash', () => {
  [null, undefined, {}, 'lỗi', 42].forEach((junk) => {
    assert.deepEqual(parseNominatim(junk), []);
  });
});

test('more results than the list can show are cut off', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    place_id: i, lat: '16.0', lon: '108.0', display_name: `Chỗ ${i}`,
  }));
  assert.equal(parseNominatim(many).length, PLACE_LIMIT);
});

/* ── Goong ──────────────────────────────────────────────────────────────── */

const goong = {
  status: 'OK',
  results: [
    {
      place_id: 'g1',
      formatted_address: 'Chợ Hàn, 119 Trần Phú, Hải Châu, Đà Nẵng',
      geometry: { location: { lat: 16.0682, lng: 108.2244 } },
    },
  ],
};

test('a Goong result reads the nested geometry', () => {
  const out = parseGoong(goong);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Chợ Hàn');
  assert.equal(out[0].address, '119 Trần Phú, Hải Châu, Đà Nẵng');
  assert.equal(out[0].lat, 16.0682);
  assert.equal(out[0].lng, 108.2244);
});

test('a Goong row with no geometry is dropped', () => {
  assert.deepEqual(parseGoong({ results: [{ place_id: 'x', formatted_address: 'Ở đâu đó' }] }), []);
  assert.deepEqual(parseGoong({ results: [{ formatted_address: 'x', geometry: {} }] }), []);
  assert.deepEqual(parseGoong({ results: [{ formatted_address: 'x', geometry: null }] }), []);
});

test('a Goong error envelope is an empty result, not a crash', () => {
  assert.deepEqual(parseGoong({ status: 'REQUEST_DENIED', results: null }), []);
  assert.deepEqual(parseGoong({}), []);
  assert.deepEqual(parseGoong(null), []);
  assert.deepEqual(parseGoong([]), [], 'mảng trần không phải khuôn Goong');
});

test('both providers answer in exactly the same shape', () => {
  const a = parseNominatim(nominatim)[0];
  const b = parseGoong(goong)[0];
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
});
