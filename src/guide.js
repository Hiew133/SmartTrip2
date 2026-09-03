/* The local guidebook, minus everything that touches a network or a database:
   which destinations a trip is actually about, and what to call the document
   that holds the guide for one of them.

   Pure functions on purpose, same as budget.js and itinerary.js — the slug
   below becomes a Firestore document id, so getting it wrong writes a second
   guidebook for a place that already has one, and that is a mistake worth a
   test rather than an eyeball. */

/** Firestore document id for one destination: ASCII, lowercase, no spaces.
 *
 *  "Hội An" and "Hoi An" deliberately collapse to the same id. Someone typing
 *  the name without diacritics means the same place, and two guidebooks for
 *  one town would be a bug, not a feature. */
export function slugFor(dest) {
  const slug = String(dest ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')     // drop the tone marks NFD just split off
    .replace(/[đĐ]/g, 'd')      // đ/Đ carry no mark to drop; they are their own letter
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');        // the slice can leave a trailing dash behind
  return slug || 'noi-den';     // never hand Firestore an empty document id
}

/* Where a trip name breaks into separate places: an en dash, a comma list, or
   a spaced hyphen. A bare hyphen is left alone — it belongs inside names as
   often as between them, so the spaces around it are what decide. */
const SPLIT = /[–—,·|/]+|\s+-\s+/;

/**
 * Destinations worth offering a guidebook for, best guess first.
 *
 * A trip title carries them more often than not — "Đà Nẵng – Hội An" is two
 * places — and the day list carries the rest. Deduplicated by slug so a title
 * and a day naming the same town do not both show up.
 */
export function destinationsOf(trip, max = 6) {
  const raw = [
    ...String(trip?.title ?? '').split(SPLIT),
    ...(trip?.days ?? []).map((d) => d?.place ?? ''),
  ];

  const seen = new Set();
  const out = [];
  raw.forEach((part) => {
    const name = String(part).trim();
    // one-letter fragments are punctuation debris, not places
    if (name.length < 2) return;
    const key = slugFor(name);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  });
  return out.slice(0, max);
}

/** True when a guidebook has nothing a person could actually read. */
export const isGuideEmpty = (g) => !g || (!g.sections?.length && !g.phrases?.length);
