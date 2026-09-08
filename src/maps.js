/* Everything the map itself asks Goong for, minus the network: which basemap
   style to load, how a day's stops become one Direction request, and how the
   answers turn into a line to draw and a distance the optimiser can use.

   Split from backend/maps.js for the same reason places.js is split from
   backend/places.js — this half is reachable from `node --test`, that half
   reads import.meta.env and is not.

   Goong is a third party whose JSON ends up drawn on a map and fed into the
   route optimiser, so every parser below treats it as hostile: a malformed
   answer yields null, never a plausible-looking wrong number. */

import { hasCoords } from './data.js';
import { haversineKm } from './itinerary.js';

const DIRECTION = 'https://rsapi.goong.io/Direction';
const MATRIX = 'https://rsapi.goong.io/DistanceMatrix';
const TILES = 'https://tiles.goong.io/assets';

/* Goong's hosted styles. Checked against this list rather than pasted through:
   a typo in the env var would otherwise fetch a 404 and leave a blank canvas
   with nothing to say why. */
export const MAP_STYLES = [
  'goong_light_v2',
  'goong_map_web',
  'goong_map_dark',
  'navigation_day',
  'navigation_night',
];

/* The lightest of the five, which is the one the paper-and-ink palette in
   organic.css was drawn against. */
export const DEFAULT_MAP_STYLE = 'goong_light_v2';

/** Vehicle profile for Direction/DistanceMatrix. Goong also takes bike, taxi, truck, hd. */
export const VEHICLE = 'car';

/* One request covers a whole day, and a day nobody would get through is not
   worth paying for. Anything past this falls back to straight lines. */
export const MAX_ROUTE_POINTS = 12;

/** Goong map styles are vector, not raster — this URL feeds MapLibre, not L.tileLayer. */
export function styleUrl(style, apiKey) {
  const name = MAP_STYLES.includes(style) ? style : DEFAULT_MAP_STYLE;
  return `${TILES}/${name}.json?api_key=${encodeURIComponent(apiKey)}`;
}

const latlng = (p) => `${p.lat},${p.lng}`;

/**
 * One Direction call for a whole day: the first stop is the origin and every
 * other one is a destination, joined by `;`. The legs come back in that order,
 * so leg i is the hop from stop i to stop i+1.
 */
export function directionUrl(points, apiKey, vehicle = VEHICLE) {
  const [origin, ...rest] = points;
  const p = new URLSearchParams({
    origin: latlng(origin),
    destination: rest.map(latlng).join(';'),
    vehicle,
    api_key: apiKey,
  });
  return `${DIRECTION}?${p}`;
}

/** Every pair of distances in one call — origins and destinations joined by `|`. */
export function distanceMatrixUrl(origins, destinations, apiKey, vehicle = VEHICLE) {
  const p = new URLSearchParams({
    origins: origins.map(latlng).join('|'),
    destinations: destinations.map(latlng).join('|'),
    vehicle,
    api_key: apiKey,
  });
  return `${MATRIX}?${p}`;
}

/* ── what makes two questions the same question ─────────────────────────── */

/* Goong's free tier is 1000 requests a day for everything put together and 5
   a second from one IP, and a day gets rewritten on every keystroke in a note.
   So the cost of a feature is decided by what counts as "the same request",
   and that is these two functions.

   Only stops that are actually on the map take part: one without coordinates
   changes nothing about the road. */
const located = (stops) => (Array.isArray(stops) ? stops : []).filter(hasCoords);

/**
 * Key for a drawn route. **Order matters** — the line follows the list, so
 * moving a stop from third to first is a different road even though the same
 * places are on it.
 */
export const routeKey = (stops) => located(stops).map((s) => `${s.lat},${s.lng}`).join(';');

/**
 * Key for a distance matrix. **Order does not matter** — the matrix holds
 * every pair either way. That is the point: after "Tối ưu tuyến đường"
 * rearranges the day, asking again is the same question, and answering it
 * from memory costs nothing.
 */
export const matrixKey = (stops) => located(stops)
  .map((s) => `${s.lat},${s.lng}`)
  .sort()
  .join('|');

/* ── reading the answers ────────────────────────────────────────────────── */

/* Same guard as places.js and schema.js: a missing number is not zero. Metres
   and seconds are never negative, and a negative one means the field was not
   what it claimed to be. */
const nonNegative = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/**
 * Google's encoded-polyline format, which Goong returns verbatim.
 *
 * Written to stop at the first byte that does not belong rather than to throw:
 * a truncated line is still worth drawing, and half a route on the map beats
 * an exception inside a render. Points outside the coordinate range end the
 * walk for the same reason `coord()` in schema.js exists — a decoder that has
 * lost sync produces numbers, not errors.
 */
export function decodePolyline(encoded) {
  if (typeof encoded !== 'string' || encoded === '') return [];

  const out = [];
  let i = 0;
  let lat = 0;
  let lng = 0;

  const chunk = () => {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      if (i >= encoded.length || shift > 30) return null;   // ran off the end, or lost sync
      byte = encoded.charCodeAt(i++) - 63;
      if (byte < 0 || byte > 63) return null;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (i < encoded.length) {
    const dLat = chunk();
    if (dLat === null) break;
    const dLng = chunk();
    if (dLng === null) break;
    lat += dLat;
    lng += dLng;
    const y = lat / 1e5;
    const x = lng / 1e5;
    if (Math.abs(y) > 90 || Math.abs(x) > 180) break;
    out.push([y, x]);
  }

  return out;
}

/**
 * Direction → the line to draw, and how far the day really is on the road.
 *
 * `km` and `minutes` are null unless every leg added up, because a partial
 * total shown as a total is worse than no number at all: the whole point of
 * putting kilometres under the day title is that someone can check the route
 * against them by eye.
 */
export function parseDirection(json) {
  const routes = json && typeof json === 'object' && Array.isArray(json.routes) ? json.routes : [];
  const route = routes[0];
  if (!route || typeof route !== 'object') return null;

  const path = decodePolyline(route.overview_polyline?.points);
  if (path.length < 2) return null;

  const legs = Array.isArray(route.legs) ? route.legs : [];
  let metres = 0;
  let seconds = 0;
  let whole = legs.length > 0;
  for (const leg of legs) {
    const d = nonNegative(leg?.distance?.value);
    const t = nonNegative(leg?.duration?.value);
    if (d === null || t === null) { whole = false; break; }
    metres += d;
    seconds += t;
  }

  return {
    path,
    km: whole ? metres / 1000 : null,
    minutes: whole ? seconds / 60 : null,
  };
}

/**
 * DistanceMatrix → metres[origin][destination], or null when the shape is not
 * the one that was asked for. A matrix of the wrong size cannot be indexed
 * safely, and guessing which row went missing would reorder somebody's day
 * around a number nobody sent.
 */
export function parseDistanceMatrix(json, rowCount, colCount) {
  const rows = json && typeof json === 'object' && Array.isArray(json.rows) ? json.rows : null;
  if (!rows || rows.length !== rowCount) return null;

  const out = [];
  for (const row of rows) {
    const cells = Array.isArray(row?.elements) ? row.elements : null;
    if (!cells || cells.length !== colCount) return null;
    out.push(cells.map((cell) => {
      if (!cell || typeof cell !== 'object') return null;
      if (typeof cell.status === 'string' && cell.status !== 'OK') return null;
      return nonNegative(cell.distance?.value);
    }));
  }
  return out;
}

/* ── feeding the optimiser ──────────────────────────────────────────────── */

/* Stops are matched to matrix rows by coordinate rather than by object
   identity: optimizeRoute hands its distance function whatever objects are in
   the list, and two stops pinned to the same place are the same row anyway. */
const cellKey = (s) => `${s.lat},${s.lng}`;

/**
 * Turn a metres matrix into the synchronous `distance(a, b)` that
 * `optimizeRoute` takes. Any pair Goong could not answer for falls back to the
 * straight line, so one missing cell costs that hop rather than the feature.
 *
 * `stops` has to be the same list, in the same order, that built the matrix.
 */
export function roadDistanceFn(stops, matrix, fallback = haversineKm) {
  const index = new Map();
  stops.forEach((s, i) => { if (!index.has(cellKey(s))) index.set(cellKey(s), i); });

  return (a, b) => {
    const i = index.get(cellKey(a));
    const j = index.get(cellKey(b));
    const metres = i === undefined || j === undefined ? null : matrix[i]?.[j] ?? null;
    return metres === null ? fallback(a, b) : metres / 1000;
  };
}

/** "1 giờ 20 phút" / "45 phút" — the driving time under the day's title. */
export function formatDuration(minutes) {
  const total = Math.round(Number(minutes) || 0);
  if (total < 1) return 'dưới 1 phút';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}
