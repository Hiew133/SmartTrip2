/* The network half of place search.

   One function, two providers, chosen by whether a Goong key is configured.
   Nominatim is the default because it needs no account at all — a fresh clone
   can search for places before it has a Firebase project, let alone a paid
   geocoder. Goong is worth the key: it knows Vietnamese business names and
   ward-level addresses that OpenStreetMap does not.

   Unlike everything else under backend/, this has no demo-mode twin. It is not
   a repository — it stores nothing and reads nothing of the user's. Offline or
   blocked, it fails the same way for everyone, and the caller says so. */

import { goongApiKey } from './config.js';
import { isSearchable, goongUrl, nominatimUrl, parseGoong, parseNominatim } from '../places.js';

export const placesProvider = () => (goongApiKey ? 'goong' : 'nominatim');

/* Nominatim asks for at most one request a second and no bulk use. The debounce
   in the UI is what keeps to that; this is the reminder of why it is there. */
export const PLACE_DEBOUNCE_MS = 650;

/**
 * Look up a place name. Returns [] for a query too short to be worth a
 * request, and throws with a Vietnamese sentence when the lookup fails —
 * the caller shows it, so it has to read like something a person wrote.
 *
 * `signal` cancels an in-flight request when the person keeps typing.
 */
export async function searchPlaces(query, { signal } = {}) {
  if (!isSearchable(query)) return [];

  const goong = goongApiKey;
  const url = goong ? goongUrl(query, goong) : nominatimUrl(query);

  let res;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;      // the caller moved on; not a failure
    throw new Error('Không kết nối được dịch vụ tìm địa điểm. Kiểm tra mạng rồi thử lại.', { cause: err });
  }

  if (!res.ok) {
    /* 429 is the one a person can act on — everything else is the provider
       having a bad day, and telling them the status code helps nobody. */
    throw new Error(res.status === 429
      ? 'Tìm địa điểm đang bị giới hạn tốc độ. Đợi vài giây rồi gõ lại.'
      : 'Dịch vụ tìm địa điểm không trả lời được. Thử lại sau một lát.');
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error('Dịch vụ tìm địa điểm trả về dữ liệu không đọc được.');
  }

  return goong ? parseGoong(json) : parseNominatim(json);
}
