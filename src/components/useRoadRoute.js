import { useEffect, useState } from 'react';
import { routeKey } from '../maps.js';
import { ROUTE_DEBOUNCE_MS, cachedRoute, roadRoute } from '../backend/maps.js';

/**
 * The real road line through a day's stops, or null while there is none.
 *
 * Returns `{ path, km, minutes }` from Goong's Direction API, and null in
 * every case where that is not available: no key configured, fewer than two
 * pinned stops, a request still in flight, or a failed one. Callers fall back
 * to the straight line, which is what the app has always drawn.
 *
 * Two things keep this off Goong's 1000-a-day meter:
 *
 * · `routeKey` is the only input. A day is rewritten on every keystroke in a
 *   note and on every cost edit, and none of that moves a road.
 * · An order that has already been answered is served from the cache in
 *   backend/maps.js **without waiting** — flipping between days is instant,
 *   and so is undoing a reorder. Only a genuinely new order waits, and it
 *   waits out the debounce first, because reordering a day by hand walks
 *   through intermediate orders nobody wants a route for.
 */
export function useRoadRoute(stops) {
  const key = routeKey(stops);
  const cached = cachedRoute(key);
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    if (cached) return undefined;      // already answered; nothing to ask

    const ctrl = new AbortController();
    let live = true;
    /* Every setState below runs inside the timer's promise, never in the
       effect body — a synchronous set here would be a cascading render. */
    const t = setTimeout(() => {
      roadRoute(stops, { signal: ctrl.signal })
        .then((found) => { if (live) setFetched(found ? { ...found, key } : null); })
        .catch(() => {});   // aborted: the stops changed under us, and the next call owns it
    }, ROUTE_DEBOUNCE_MS);

    return () => { live = false; clearTimeout(t); ctrl.abort(); };
    // stops is rebuilt on every unrelated edit; the coordinates are the input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cached]);

  /* The stale answer is dropped here rather than cleared on the way in, so a
     day whose route is being recomputed keeps showing the old line for the
     moment it takes instead of flicking back to dashes and forward again. */
  return cached ?? (fetched && fetched.key === key ? fetched : null);
}
