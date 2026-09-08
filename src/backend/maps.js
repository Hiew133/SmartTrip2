/* The network half of the map: Goong's basemap, road route and road distances.

   Like backend/places.js and unlike everything else under backend/, this is
   not a repository and has no demo-mode twin. It stores nothing, reads nothing
   of the user's, and fails the same way for everyone.

   The rule the whole file is built on: none of this is load-bearing. Without a
   Goong key the map falls back to OpenStreetMap tiles and straight dashed
   lines between pins, which is exactly what SmartTrip did before — so every
   failure here returns null and lets the caller draw the old thing, rather
   than throwing into a render. */

import { hasCoords } from '../data.js';
import { goongApiKey, goongMapStyle, goongMapTilesKey } from './config.js';
import {
  MAX_ROUTE_POINTS, directionUrl, distanceMatrixUrl, matrixKey,
  parseDirection, parseDistanceMatrix, roadDistanceFn, routeKey, styleUrl,
} from '../maps.js';

/**
 * What to put under the pins. Two keys, because Goong issues two: the REST key
 * (rsapi) does not open the tile server and the Maptiles key does not open the
 * REST API, so either half can be configured without the other.
 */
export function basemap() {
  if (!goongMapTilesKey) return { kind: 'osm' };
  return { kind: 'goong', style: styleUrl(goongMapStyle, goongMapTilesKey) };
}

/** True when Direction / DistanceMatrix can be called at all. */
export const roadRoutingAvailable = () => !!goongApiKey;

/* Not every stop is on the map yet — a hand-added one has no coordinates until
   somebody picks a suggestion — and a route needs at least two ends. */
const routable = (stops) => (Array.isArray(stops) ? stops.filter(hasCoords) : []);

/* ── not asking twice ───────────────────────────────────────────────────── */

/* Goong's free tier is 1000 requests a day across every service and 5 a second
   from one IP, shared by everybody editing the trip. Two things spend it
   faster than the feature is worth:

   · every drag of a stop is a new order, and a new order is a new route;
   · flipping Ngày 1 → Ngày 2 → Ngày 1 asks the same question three times.

   The debounce below handles the first, this cache handles the second. Keyed
   by coordinates, so it is shared across trips and across days — two people
   walking the same three places walk the same road.

   Only answers are kept, never failures: a 403 today is a key that gets
   activated tomorrow, and caching that would need a reload to recover from. */
const CACHE_MAX = 24;
const routes = new Map();
const matrices = new Map();

/** The cached route for these stops, or undefined if it has not been asked yet. */
export const cachedRoute = (key) => routes.get(key);

/* Insertion-ordered eviction: re-setting moves a key to the back, so the entry
   dropped is the one nobody has looked at for the longest. */
function remember(store, key, value) {
  if (store.has(key)) store.delete(key);
  store.set(key, value);
  if (store.size > CACHE_MAX) store.delete(store.keys().next().value);
}

/**
 * How long to sit on a change before asking Goong about it.
 *
 * Reordering a day is done by hand, a stop at a time, and every intermediate
 * order is one nobody wants a road for. Same reasoning as PLACE_DEBOUNCE_MS in
 * backend/places.js, and the 5-requests-a-second cap makes it a rate limit too,
 * not only thrift.
 */
export const ROUTE_DEBOUNCE_MS = 700;

async function askGoong(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Goong ${res.status}`);
  return res.json();
}

/* An aborted request is the caller moving on, not a failure, so it stays a
   rejection the caller can recognise. Everything else is logged once and
   answered with null: the map has a correct thing to draw without us. */
function shrug(err, what) {
  if (err?.name === 'AbortError') throw err;
  console.warn(`SmartTrip · Goong ${what}:`, err);
  return null;
}

/* A 200 whose body is not the shape we asked for is the failure mode that
   hides: everything degrades to straight lines and nothing looks broken.

   It is also the likeliest one. Goong's published example for DistanceMatrix
   shows a single `origins` value with several `destinations`; asking for a
   full N×N matrix by joining origins with `|` is an extrapolation from that.
   If it turns out they do not serve it, this warning is where it says so,
   rather than the optimiser quietly measuring in straight lines forever. */
function unusable(what, json) {
  console.warn(
    `SmartTrip · Goong ${what} trả lời 200 nhưng không đúng shape mong đợi — `
    + 'đang dùng đường chim bay thay thế. Kiểm tra tham số gửi đi và câu trả lời dưới đây.',
    json,
  );
  return null;
}

/**
 * The real road line through a day's stops, in the order they are listed.
 *
 * Returns `{ path, km, minutes }` — `path` is [[lat, lng], …] for the map,
 * `km` and `minutes` are the whole day on the road, or null when Goong
 * answered with legs that did not add up. Returns null when there is nothing
 * to route, no key, or the request failed.
 */
export async function roadRoute(stops, { signal } = {}) {
  if (!goongApiKey) return null;
  const points = routable(stops);
  if (points.length < 2 || points.length > MAX_ROUTE_POINTS) return null;

  const key = routeKey(points);
  const hit = routes.get(key);
  if (hit) return hit;

  try {
    const json = await askGoong(directionUrl(points, goongApiKey), signal);
    const found = parseDirection(json);
    if (!found) return unusable('Direction', json);
    remember(routes, key, found);
    return found;
  } catch (err) {
    return shrug(err, 'Direction');
  }
}

/**
 * A `distance(a, b)` in kilometres that follows roads, for `optimizeRoute`.
 *
 * The optimiser's distance function has to be synchronous, so the whole
 * matrix is fetched up front — one call for every pair, which is what the
 * seam in itinerary.js was left open for. Returns null when the road numbers
 * are not available, and the caller then optimises on straight lines and says
 * so; a route quietly optimised against the wrong metric is indistinguishable
 * from a good one by eye, which is the reason that distinction is surfaced.
 */
export async function roadDistance(stops, { signal } = {}) {
  if (!goongApiKey) return null;
  const points = routable(stops);
  if (points.length < 3 || points.length > MAX_ROUTE_POINTS) return null;

  /* Keyed order-independently, and the cached value is the finished lookup
     function — it matches stops to rows by coordinate, so it stays correct
     after the optimiser has rearranged the very day it was built for. Pressing
     "Tối ưu tuyến đường" a second time is therefore free. */
  const key = matrixKey(points);
  const hit = matrices.get(key);
  if (hit) return hit;

  try {
    const json = await askGoong(distanceMatrixUrl(points, points, goongApiKey), signal);
    const matrix = parseDistanceMatrix(json, points.length, points.length);
    if (!matrix) return unusable('DistanceMatrix', json);
    const distance = roadDistanceFn(points, matrix);
    remember(matrices, key, distance);
    return distance;
  } catch (err) {
    return shrug(err, 'DistanceMatrix');
  }
}
