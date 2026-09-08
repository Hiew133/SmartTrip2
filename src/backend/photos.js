/* The network half of trip covers: ask Wikipedia what is near a coordinate,
   keep the answer.

   Like backend/places.js and backend/offline.js, this is not a repository and
   has no demo-mode twin. It stores nothing belonging to a trip and nothing
   another member will read — one browser's own note of "the photo for this
   corner of the map".

   Nothing here is load-bearing. Every failure returns null and the cover falls
   back to the gradient-and-contour plate that `.st-plate` draws anyway, which
   is a deliberate design and not an error state. */

import { PHOTO_LANGS, geoPhotoUrl, parsePhotos, photoKey, pickPhoto } from '../photos.js';

const CACHE_KEY = 'smarttrip-photos-v1';

/** How many coordinates one device remembers a cover for. */
const CACHE_CAP = 120;

/* A negative answer is worth keeping too, and for longer than it sounds:
   without it, every render of a trip in the middle of nowhere is another
   request to Wikipedia for an answer that will not change today. */
const MISS_TTL_MS = 24 * 60 * 60 * 1000;

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};                        // private mode, or a value we did not write
  }
};

const write = (map) => {
  try {
    /* Insertion order is oldest-first, so slicing from the end keeps what has
       been looked up most recently. */
    const entries = Object.entries(map).slice(-CACHE_CAP);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* quota — the covers are not worth failing over */ }
};

/** The remembered cover for this point: a URL, or null when it is a known miss. */
export function cachedPhoto(lat, lng) {
  const hit = read()[photoKey(lat, lng)];
  if (!hit || typeof hit !== 'object') return undefined;
  if (typeof hit.url === 'string') return hit.url;
  return Date.now() - (hit.at || 0) < MISS_TTL_MS ? null : undefined;
}

function remember(lat, lng, url) {
  const map = read();
  const key = photoKey(lat, lng);
  delete map[key];                    // re-insert so it counts as recently used
  map[key] = url ? { url } : { at: Date.now() };
  write(map);
}

async function ask(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  return res.json();
}

/**
 * A photograph of somewhere near this point, or null if there is none.
 *
 * `hint` is the name of the stop the search is anchored to, and it decides
 * which of the nearby articles wins — see pickPhoto.
 */
export async function placePhoto(lat, lng, hint = '', { signal } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const hit = cachedPhoto(lat, lng);
  if (hit !== undefined) return hit;

  for (const lang of PHOTO_LANGS) {
    try {
      const found = pickPhoto(parsePhotos(await ask(geoPhotoUrl(lat, lng, lang), signal)), hint);
      if (found) {
        remember(lat, lng, found.url);
        return found.url;
      }
    } catch (err) {
      if (err?.name === 'AbortError') throw err;   // the caller moved on
      /* Wikipedia rate-limits anonymous callers, and a cover is not worth a
         retry storm. Log once, try the next language, then give up quietly. */
      console.warn(`SmartTrip · ảnh địa điểm (${lang}):`, err);
    }
  }

  remember(lat, lng, null);
  return null;
}
