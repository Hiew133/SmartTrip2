import { useEffect, useState } from 'react';
import { photoAnchor, photoKey } from '../photos.js';
import { cachedPhoto, placePhoto } from '../backend/photos.js';

/**
 * A photograph of somewhere on this trip, or null while there is none.
 *
 * Null is a perfectly good answer: `.st-plate` draws a gradient with contour
 * lines under every cover, so a trip with no pinned stops — a brand new one,
 * or one somewhere Wikipedia has never heard of — still looks composed. That
 * is the design, not a broken image.
 *
 * The cache is read during render rather than in an effect, so a trip whose
 * cover was fetched a moment ago on the list screen appears with its photo
 * already on the first frame instead of flashing the plate.
 */
export function useTripPhoto(trip) {
  const anchor = photoAnchor(trip);
  const cached = anchor ? cachedPhoto(anchor.lat, anchor.lng) : null;
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    if (!anchor || cached !== undefined) return undefined;

    const ctrl = new AbortController();
    let live = true;
    placePhoto(anchor.lat, anchor.lng, anchor.hint, { signal: ctrl.signal })
      .then((url) => { if (live) setFetched({ key: photoKey(anchor.lat, anchor.lng), url }); })
      .catch(() => {});   // aborted, or Wikipedia declined; the plate stands in

    return () => { live = false; ctrl.abort(); };
    // the coordinate is the whole input; the trip object changes on every edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor && photoKey(anchor.lat, anchor.lng), cached]);

  if (!anchor) return null;
  if (cached !== undefined) return cached;
  return fetched && fetched.key === photoKey(anchor.lat, anchor.lng) ? fetched.url : null;
}
