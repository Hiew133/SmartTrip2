/* What this device keeps for when there is no network.
 *
 * Like backend/places.js, this is not a repository and has no demo-mode twin:
 * it stores nothing that belongs to a trip and nothing another member will
 * ever read. It is one browser's own copy, and it behaves the same whether a
 * Firebase project is attached or not.
 *
 * It exists because both new features are used in the worst possible network
 * conditions — standing in a market abroad, roaming off, asking what a sign
 * says. A guidebook that only loads when Firestore answers is a guidebook that
 * is missing exactly when it is needed, so every one that is read gets written
 * through to here, and the reader falls back to it when the round-trip fails.
 *
 * Everything read back goes through schema.js first. A value in localStorage
 * is as untrusted as a document from the database: this build did not
 * necessarily write it, and an older one may have written a different shape. */

import { cleanGuide, cleanTranslation } from './schema.js';
import { remember } from '../phrasebook.js';

const PHRASE_KEY = 'smarttrip-phrases-v1';
const GUIDE_KEY = 'smarttrip-guides-v1';

/** How many destinations' guidebooks one device keeps. */
const GUIDE_CAP = 20;

const read = (key) => {
  try {
    const raw = JSON.parse(localStorage.getItem(key));
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;                      // private mode, or a value we did not write
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota or private mode — the feature still works, it just forgets */ }
};

/* ── phrasebook ─────────────────────────────────────────────────────────── */

/** Everything this device has translated, newest first. */
export function readPhrases() {
  const raw = read(PHRASE_KEY);
  return (Array.isArray(raw?.phrases) ? raw.phrases : [])
    .map(cleanTranslation)
    .filter(Boolean);
}

/** Remember one translation and hand back the list as it now stands. */
export function savePhrase(entry) {
  const clean = cleanTranslation(entry);
  if (!clean) return readPhrases();
  const next = remember(readPhrases(), clean);
  write(PHRASE_KEY, { phrases: next });
  return next;
}

export function forgetPhrases() {
  write(PHRASE_KEY, { phrases: [] });
  return [];
}

/* ── guidebooks ─────────────────────────────────────────────────────────── */

const guideKey = (tripId, slug) => `${tripId}::${slug}`;

/** The last copy this device saw of one destination's guidebook, or null. */
export function cachedGuide(tripId, slug) {
  const raw = read(GUIDE_KEY);
  return cleanGuide(raw?.guides?.[guideKey(tripId, slug)]);
}

/** Keep a copy for the next time the network is gone. */
export function cacheGuide(tripId, slug, guide) {
  const clean = cleanGuide(guide);
  if (!clean) return;
  const raw = read(GUIDE_KEY);
  const guides = raw?.guides && typeof raw.guides === 'object' ? { ...raw.guides } : {};
  delete guides[guideKey(tripId, slug)];          // re-insert at the end, newest last
  const entries = Object.entries(guides).slice(-(GUIDE_CAP - 1));
  write(GUIDE_KEY, {
    guides: { ...Object.fromEntries(entries), [guideKey(tripId, slug)]: clean },
  });
}

/** Drop one guidebook, or every guidebook belonging to a trip that is gone. */
export function forgetGuides(tripId, slug = null) {
  const raw = read(GUIDE_KEY);
  if (!raw?.guides || typeof raw.guides !== 'object') return;
  const prefix = `${tripId}::`;
  const keep = Object.entries(raw.guides).filter(([k]) => (slug
    ? k !== guideKey(tripId, slug)
    : !k.startsWith(prefix)));
  write(GUIDE_KEY, { guides: Object.fromEntries(keep) });
}
