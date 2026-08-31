/* Ordering a day's stops: distance on the ground, clock order, and the moves
   that rearrange the list.

   Pure functions, kept out of the screen component so they can be tested with
   `node --test` — this is where a wrong answer is least visible, because a
   plausible-looking route is indistinguishable from an optimal one by eye. */

import { hasCoords } from './data.js';

const R_KM = 6371.0088;
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Great-circle distance in kilometres.
 *
 * The old version compared (Δlat)² + (Δlng)², which is wrong in two ways: a
 * degree of longitude is shorter than a degree of latitude everywhere except
 * the equator (in Vietnam, ~4% shorter; in Europe, ~35%), so east–west hops
 * were systematically over-weighted, and the number it produced meant nothing
 * so it could never be shown to anyone.
 */
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total distance along the stops that have coordinates, in kilometres. */
export function routeLengthKm(items, distance = haversineKm) {
  const pts = items.filter(hasCoords);
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += distance(pts[i - 1], pts[i]);
  return sum;
}

/**
 * Nearest-neighbour reorder: keep the first stop, then always hop to the
 * closest remaining one. Each stop carries its own time along with it — the
 * route may change, but "18:30 · bàn hải sản đã đặt" stays at 18:30. Stops
 * with no coordinates yet are left at the end, in their original order.
 *
 * `distance` is a seam: swap in a road-distance function and the same greedy
 * walk optimises for driving time instead of straight lines. It has to be
 * synchronous, so a Directions API needs its distances fetched up front.
 */
export function optimizeRoute(items, distance = haversineKm) {
  const located = items.filter(hasCoords);
  const rest = items.filter((s) => !hasCoords(s));
  if (located.length < 3) return items;

  const left = located.slice(1);
  const route = [located[0]];
  while (left.length) {
    const cur = route[route.length - 1];
    let best = 0, bestD = Infinity;
    left.forEach((s, i) => {
      const d = distance(cur, s);
      if (d < bestD) { bestD = d; best = i; }
    });
    route.push(left.splice(best, 1)[0]);
  }
  return [...route, ...rest];
}

/* ── clock order ────────────────────────────────────────────────────────── */

/** Minutes past midnight, or null for a stop whose time was never filled in. */
export const asMinutes = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.time || '');
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
};

/** True when some stop is scheduled before the one listed above it. */
export const isOutOfOrder = (items) => items.some((it, i) => {
  if (i === 0) return false;
  const a = asMinutes(items[i - 1]), b = asMinutes(it);
  return a !== null && b !== null && b < a;
});

/** Sorted by clock time; stops with no time sink to the end, order preserved. */
export const byTime = (items) => items
  .map((s, i) => ({ s, i }))
  .sort((x, y) => (asMinutes(x.s) ?? 1e9) - (asMinutes(y.s) ?? 1e9) || x.i - y.i)
  .map(({ s }) => s);

/* ── moving one row ─────────────────────────────────────────────────────── */

/**
 * Move the item at `from` so it lands at index `to`. Shared by drag-and-drop,
 * the up/down buttons and keyboard reordering, so all three can never disagree
 * about what "move down" means. Out-of-range indices return the list unchanged
 * rather than throwing — a drop can land anywhere.
 */
export function moveItem(list, from, to) {
  if (from === to) return list;
  if (from < 0 || from >= list.length) return list;
  const clamped = Math.min(Math.max(to, 0), list.length - 1);
  if (clamped === from) return list;
  const next = list.slice();
  const [moved] = next.splice(from, 1);
  next.splice(clamped, 0, moved);
  return next;
}
