/* Place search, the half that has no network in it: how a query becomes a URL
   and how a provider's answer becomes the app's own shape.

   Kept apart from backend/places.js so it can be tested with `node --test`.
   backend/places.js reads import.meta.env, which does not exist outside Vite,
   so anything importing it is unreachable from a plain node process.

   Two providers, one output shape:
     Nominatim (OpenStreetMap) — no key, no account, works on a fresh clone.
     Goong                     — needs a key, much better on Vietnamese
                                 addresses and business names.

   Everything below treats the response as hostile: a geocoder is a third party
   and its JSON goes straight into trip data that the map then renders. */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const GOONG = 'https://rsapi.goong.io/geocode';

/** How many suggestions to show. More than this is a scrolling list nobody reads. */
export const PLACE_LIMIT = 6;

export function nominatimUrl(query) {
  const p = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: String(PLACE_LIMIT),
    addressdetails: '1',
    'accept-language': 'vi',
  });
  return `${NOMINATIM}?${p}`;
}

export function goongUrl(query, apiKey) {
  const p = new URLSearchParams({ address: query, api_key: apiKey });
  return `${GOONG}?${p}`;
}

/* Same guard as backend/schema.js, and for the same reason: Number(null) is 0,
   and 0 is a real place in the Gulf of Guinea. "Missing" and "zero" have to
   stay different answers. */
const inRange = (n, limit) => (Number.isFinite(n) && Math.abs(n) <= limit ? n : null);

const coord = (v, limit) => {
  if (typeof v === 'number') return inRange(v, limit);
  if (typeof v === 'string' && v.trim() !== '') return inRange(Number(v), limit);
  return null;
};

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/* Nominatim sends place_id as a number and Goong sends it as a string. It is
   only ever a React key, so either is fine — as long as both arrive as one. */
const idOf = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : text(v));

/* A result is only useful if it can be put on the map and named on the list,
   so anything missing either one is dropped rather than shown as a dead row. */
const place = (id, name, address, rawLat, rawLng) => {
  const lat = coord(rawLat, 90);
  const lng = coord(rawLng, 180);
  const label = text(name) || text(address);
  if (lat === null || lng === null || !label) return null;
  return { id: idOf(id) || `${lat},${lng}`, name: label, address: text(address), lat, lng };
};

/** Nominatim jsonv2: a flat array, coordinates as strings in `lat` / `lon`. */
export function parseNominatim(json) {
  if (!Array.isArray(json)) return [];
  return json.map((r) => {
    if (!r || typeof r !== 'object') return null;
    const display = text(r.display_name);
    // display_name is the full "name, ward, district, city, country" chain;
    // the first segment is the name, the rest is the address under it
    const head = text(r.name) || display.split(',')[0];
    const tail = display.startsWith(head) ? display.slice(head.length).replace(/^,\s*/, '') : display;
    return place(r.place_id, head, tail, r.lat, r.lon);
  }).filter(Boolean).slice(0, PLACE_LIMIT);
}

/** Goong geocode: `{ results: [{ formatted_address, geometry: { location } }] }`. */
export function parseGoong(json) {
  const rows = json && typeof json === 'object' && Array.isArray(json.results) ? json.results : [];
  return rows.map((r) => {
    if (!r || typeof r !== 'object') return null;
    const address = text(r.formatted_address);
    const head = text(r.name) || address.split(',')[0];
    const tail = address.startsWith(head) ? address.slice(head.length).replace(/^,\s*/, '') : address;
    const loc = r.geometry && typeof r.geometry === 'object' ? r.geometry.location : null;
    return place(r.place_id, head, tail, loc?.lat, loc?.lng);
  }).filter(Boolean).slice(0, PLACE_LIMIT);
}

/** A query worth spending a request on. */
export const isSearchable = (q) => text(q).length >= 3;
