/* Finding a photo of the place a trip is actually about.

   The covers used to be `picsum.photos/seed/<random>` — a stable random image
   per trip, which looked composed and meant nothing. Two trips to Hội An got
   two unrelated photographs, and a trip created from an AI draft looked
   identical to the one beside it.

   The fix uses something the app already has: **coordinates**. Every stop that
   came from place search or from the model carries a real lat/lng, and
   Wikipedia will list articles near a point along with their lead images. So
   the cover of a trip is a photograph of somewhere on that trip.

   Searching by *name* was tried first and abandoned: Wikipedia's full-text
   search answered "Đà Nẵng" with "Quần đảo Hoàng Sa", and opensearch answered
   it with a film. A coordinate cannot be misread that way.

   Network and caching live in backend/photos.js; this half is URL-building and
   answer-reading, so it can be tested with `node --test`. */

import { hasCoords } from './data.js';

/* Vietnamese first — the trips are mostly Vietnamese places and vi.wikipedia
   has the better coverage of them — then English for everywhere else. */
export const PHOTO_LANGS = ['vi', 'en'];

/** Metres around the anchor to look in. Wide enough for a district, tight
 *  enough that the photo is somewhere you could walk to from the stop. */
export const PHOTO_RADIUS_M = 4000;

/**
 * Articles near a point, with their lead images.
 *
 * `origin=*` is what makes this readable from a browser: it asks the MediaWiki
 * API for an anonymous CORS response. Without it every request fails at the
 * fetch, not at the parse.
 */
export function geoPhotoUrl(lat, lng, lang = 'vi', { radius = PHOTO_RADIUS_M, limit = 8, thumb = 1200 } = {}) {
  const p = new URLSearchParams({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${lat}|${lng}`,
    ggsradius: String(radius),
    ggslimit: String(limit),
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: String(thumb),
    format: 'json',
    origin: '*',
  });
  return `https://${lang}.wikipedia.org/w/api.php?${p}`;
}

/** Only rows that actually carry an image are worth anything to a cover. */
export function parsePhotos(json) {
  const pages = json && typeof json === 'object' ? json.query?.pages : null;
  if (!pages || typeof pages !== 'object') return [];
  return Object.values(pages)
    .map((p) => {
      const src = p?.thumbnail?.source;
      if (typeof src !== 'string' || !src.startsWith('https://')) return null;
      const title = typeof p.title === 'string' ? p.title : '';
      const w = Number(p.thumbnail.width) || 0;
      const h = Number(p.thumbnail.height) || 0;
      return { title, url: src, width: w, height: h };
    })
    .filter(Boolean);
}

/* Words that appear in half the place names in Vietnam and so say nothing
   about which of two candidates is the better match. */
const NOISE = new Set([
  'bai', 'bien', 'chua', 'cau', 'nui', 'song', 'ho', 'pho', 'duong', 'khu',
  'thanh', 'quan', 'huyen', 'tinh', 'xa', 'dao', 'vinh', 'den', 'thap', 'cho',
  'the', 'of', 'and', 'in', 'da', 'la', 'le',
]);

/* Diacritics off, punctuation out: "Bãi biển Mỹ Khê" and "Biển Mỹ Khê" have to
   agree on "my" and "khe" for the match to be worth anything. */
export const words = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .filter((w) => w.length > 1 && !NOISE.has(w));

/**
 * The best of the candidates for a cover.
 *
 * Scored on how much of the hint — the name of the stop the search was
 * anchored to — shows up in the article title, then on shape: a wide photo
 * crops into a banner without cutting the subject's head off. A tie falls back
 * to the order Wikipedia gave, which is by distance from the anchor.
 */
export function pickPhoto(rows, hint = '') {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!list.length) return null;

  const want = new Set(words(hint));
  const score = (row) => {
    const have = words(row.title);
    const shared = have.filter((w) => want.has(w)).length;
    const landscape = row.width > 0 && row.height > 0 && row.width >= row.height ? 1 : 0;
    return shared * 10 + landscape;
  };

  return list.reduce((best, row) => (score(row) > score(best) ? row : best), list[0]);
}

/**
 * Where to look, and what to call it.
 *
 * The first stop with coordinates anywhere in the trip: a trip has no
 * coordinates of its own, and the first pinned stop is the closest thing to
 * "where this trip is". Its name is the hint, not the trip title — "Đà Nẵng –
 * Hội An" matches no article, while "Biển Mỹ Khê" matches one exactly.
 */
export function photoAnchor(trip) {
  for (const day of trip?.days ?? []) {
    for (const stop of day?.items ?? []) {
      if (hasCoords(stop)) return { lat: stop.lat, lng: stop.lng, hint: stop.name || day.place || '' };
    }
  }
  return null;
}

/* Rounded to about 100 m. Two stops on the same street should share one
   lookup and one cache entry — the photo would be the same either way. */
export const photoKey = (lat, lng) => `${lat.toFixed(3)},${lng.toFixed(3)}`;
