import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHOTO_RADIUS_M, geoPhotoUrl, parsePhotos, photoAnchor, photoKey, pickPhoto, words,
} from '../../src/photos.js';

/* Covers come from Wikipedia, which is a third party whose JSON ends up as an
   <img src> on the trip list. Same footing as the geocoders: parse defensively,
   and let a bad answer be no cover rather than a broken one. */

/* ── asking ─────────────────────────────────────────────────────────────── */

test('the request is anchored on a coordinate and asks for CORS', () => {
  const url = new URL(geoPhotoUrl(16.0611, 108.2467));
  assert.equal(url.origin + url.pathname, 'https://vi.wikipedia.org/w/api.php');
  assert.equal(url.searchParams.get('generator'), 'geosearch');
  assert.equal(url.searchParams.get('ggscoord'), '16.0611|108.2467');
  assert.equal(url.searchParams.get('ggsradius'), String(PHOTO_RADIUS_M));
  // without origin=* the browser never sees the answer at all
  assert.equal(url.searchParams.get('origin'), '*');
});

test('the language is part of the host, not a parameter', () => {
  assert.equal(new URL(geoPhotoUrl(1, 2, 'en')).host, 'en.wikipedia.org');
  assert.equal(new URL(geoPhotoUrl(1, 2, 'vi')).host, 'vi.wikipedia.org');
});

/* ── reading ────────────────────────────────────────────────────────────── */

const page = (title, url, width = 1200, height = 800) => ({
  title, thumbnail: url ? { source: url, width, height } : undefined,
});

const answer = (...pages) => ({ query: { pages: Object.fromEntries(pages.map((p, i) => [i, p])) } });

test('only articles that carry a picture are candidates', () => {
  const rows = parsePhotos(answer(
    page('Cầu Sông Hàn', 'https://upload.wikimedia.org/a.jpg'),
    page('An Hải, Đà Nẵng', null),
  ));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Cầu Sông Hàn');
});

test('a thumbnail that is not an https URL is not a photo', () => {
  assert.deepEqual(parsePhotos(answer(page('x', 'javascript:alert(1)'))), []);
  assert.deepEqual(parsePhotos(answer(page('x', 'http://upload.wikimedia.org/a.jpg'))), []);
});

test('junk instead of an answer is no candidates, not a crash', () => {
  for (const junk of [null, undefined, {}, 'nope', 42, { query: {} }, { query: { pages: 'x' } }]) {
    assert.deepEqual(parsePhotos(junk), []);
  }
});

/* ── choosing ───────────────────────────────────────────────────────────── */

test('the stop being searched for wins over the merely nearby', () => {
  const rows = parsePhotos(answer(
    page('Cầu Sông Hàn', 'https://upload.wikimedia.org/han.jpg'),
    page('Bãi biển Mỹ Khê', 'https://upload.wikimedia.org/mykhe.jpg'),
    page('Wyndham Soleil Đà Nẵng', 'https://upload.wikimedia.org/w.jpg'),
  ));
  // diacritics and the generic word "bãi" must not stop these from matching
  assert.equal(pickPhoto(rows, 'Biển Mỹ Khê').title, 'Bãi biển Mỹ Khê');
});

test('with nothing to go on it prefers a wide picture, then the nearest', () => {
  const rows = parsePhotos(answer(
    page('Toà nhà', 'https://upload.wikimedia.org/tall.jpg', 800, 1600),
    page('Quảng trường', 'https://upload.wikimedia.org/wide.jpg', 1600, 900),
  ));
  assert.equal(pickPhoto(rows, 'không khớp gì cả').title, 'Quảng trường');

  // geosearch returns nearest-first, so a tie keeps that order
  const tie = parsePhotos(answer(
    page('Gần nhất', 'https://upload.wikimedia.org/a.jpg', 1200, 800),
    page('Xa hơn', 'https://upload.wikimedia.org/b.jpg', 1200, 800),
  ));
  assert.equal(pickPhoto(tie, '').title, 'Gần nhất');
});

test('no candidates means no cover', () => {
  assert.equal(pickPhoto([], 'Hội An'), null);
  assert.equal(pickPhoto(null, 'Hội An'), null);
});

test('words strips diacritics and drops the words every place name has', () => {
  assert.deepEqual(words('Bãi biển Mỹ Khê'), ['my', 'khe']);
  assert.deepEqual(words('Chùa Cầu'), []);          // both are noise on their own
  assert.deepEqual(words('Đà Nẵng'), ['nang']);     // "da" is noise, đ folds to d
  assert.deepEqual(words(null), []);
});

/* ── where to look ──────────────────────────────────────────────────────── */

const stop = (over) => ({ id: 's', time: '09:00', name: '', note: '', cost: 0, lat: null, lng: null, ...over });

test('the anchor is the first pinned stop, and its name is the hint', () => {
  const trip = {
    days: [
      { place: 'Đà Nẵng', items: [stop({ name: 'Chưa ghim' }), stop({ name: 'Biển Mỹ Khê', lat: 16.06, lng: 108.24 })] },
      { place: 'Hội An', items: [stop({ name: 'Phố cổ', lat: 15.88, lng: 108.33 })] },
    ],
  };
  assert.deepEqual(photoAnchor(trip), { lat: 16.06, lng: 108.24, hint: 'Biển Mỹ Khê' });
});

test('a stop with no name falls back to the day it is in', () => {
  const trip = { days: [{ place: 'Hội An', items: [stop({ name: '', lat: 15.88, lng: 108.33 })] }] };
  assert.equal(photoAnchor(trip).hint, 'Hội An');
});

test('a trip nobody has pinned anything in has no anchor', () => {
  assert.equal(photoAnchor({ days: [] }), null);
  assert.equal(photoAnchor({ days: [{ place: 'x', items: [stop({})] }] }), null);
  assert.equal(photoAnchor(null), null);
  assert.equal(photoAnchor(undefined), null);
});

test('two stops on the same street share one lookup', () => {
  assert.equal(photoKey(16.06112, 108.24671), photoKey(16.06139, 108.24698));
  assert.notEqual(photoKey(16.061, 108.246), photoKey(15.881, 108.338));
});
