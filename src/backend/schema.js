import { CATEGORIES, uid } from '../data.js';

/* Defensive parsing for every trip that comes from outside this module —
   localStorage, or a Firestore document written by an older build or another
   client. A malformed payload used to take the whole app down with no way
   back; here each field is coerced to something the UI can render, and a trip
   that cannot be repaired is dropped rather than crashed on. */

export const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const arr = (v) => (Array.isArray(v) ? v : []);
export const str = (v, fb = '') => (typeof v === 'string' ? v : fb);
export const num = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);
const iso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/* Coordinates are the one field where "missing" and "zero" are different
   answers, so this cannot go through num().

   It used to: `Number.isFinite(Number(v)) ? Number(v) : null`. But Number(null)
   is 0 and 0 is finite, so every stop added by hand — newStop() writes
   lat: null, lng: null — came back from the backend at latitude 0, longitude 0.
   hasCoords() then said yes, and the stop was pinned in the Gulf of Guinea and
   fed into the route optimiser, while the editor still told the person their
   stop had no coordinates. Only a real number, or a string holding one, counts;
   the range check keeps a nonsense value from throwing inside Leaflet. */
const inRange = (n, limit) => (Number.isFinite(n) && Math.abs(n) <= limit ? n : null);

const coord = (v, limit) => {
  if (typeof v === 'number') return inRange(v, limit);
  if (typeof v === 'string' && v.trim() !== '') return inRange(Number(v), limit);
  return null;
};

const lat = (v) => coord(v, 90);
const lng = (v) => coord(v, 180);

export function cleanStop(raw) {
  if (!isObj(raw)) return null;
  return {
    id: str(raw.id) || uid('stop'),
    time: /^\d{1,2}:\d{2}$/.test(raw.time) ? raw.time : '--:--',
    name: str(raw.name, 'Điểm dừng'),
    note: str(raw.note, ''),
    cost: Math.max(0, num(raw.cost, 0)),
    lat: lat(raw.lat),
    lng: lng(raw.lng),
  };
}

export function cleanDay(raw) {
  if (!isObj(raw)) return null;
  return {
    id: str(raw.id) || uid('day'),
    place: str(raw.place, ''),
    seed: str(raw.seed, ''),
    items: arr(raw.items).map(cleanStop).filter(Boolean),
  };
}

export function cleanMember(raw) {
  if (!isObj(raw)) return null;
  const email = str(raw.email);
  if (!email) return null;
  return {
    id: str(raw.id) || uid('mem'),
    name: str(raw.name) || email.split('@')[0],
    email,
    role: ['owner', 'edit', 'view'].includes(raw.role) ? raw.role : 'view',
    pending: raw.pending === true,
    // set once an invited person signs in and claims their seat
    uid: str(raw.uid) || null,
  };
}

export function cleanTrip(raw) {
  if (!isObj(raw)) return null;
  const members = arr(raw.members).map(cleanMember).filter(Boolean);
  if (!members.length) return null;          // no members ⇒ no way to split money
  if (!members.some((m) => m.role === 'owner')) members[0].role = 'owner';

  const ids = new Set(members.map((m) => m.id));
  const fallbackPayer = members.find((m) => !m.pending)?.id ?? members[0].id;
  const expenses = arr(raw.expenses)
    .filter(isObj)
    .map((e) => ({
      id: str(e.id) || uid('exp'),
      name: str(e.name, 'Khoản chi'),
      cat: CATEGORIES.includes(e.cat) ? e.cat : CATEGORIES[CATEGORIES.length - 1],
      // an orphaned payer would silently vanish from the balances, so re-home it
      payerId: ids.has(e.payerId) ? e.payerId : fallbackPayer,
      amount: Math.max(0, num(e.amount, 0)),
    }));

  const settled = isObj(raw.settled)
    ? Object.fromEntries(Object.entries(raw.settled).filter(([, v]) => v === true))
    : {};

  return {
    id: str(raw.id) || uid('trip'),
    title: str(raw.title, 'Chuyến đi'),
    seed: str(raw.seed) || `trip-${Math.random().toString(36).slice(2, 8)}`,
    alt: str(raw.alt, 'Ảnh bìa chuyến đi'),
    body: str(raw.body, ''),
    startDate: iso(raw.startDate),
    endDate: iso(raw.endDate),
    plan: Math.max(0, num(raw.plan, 0)),
    days: arr(raw.days).map(cleanDay).filter(Boolean),
    expenses,
    members,
    settled,
    ownerId: str(raw.ownerId) || null,
    createdAt: num(raw.createdAt, 0),
  };
}

export const cleanTrips = (list) => arr(list).map(cleanTrip).filter(Boolean);

/* ── guidebook and translations ─────────────────────────────────────────────

   Both are written by a language model and read back from Firestore or from
   this device's own cache, so they are exactly as untrusted as a trip is.

   The clipping is not cosmetic. Security Rules cannot walk a list, so they can
   only cap how many rows a guidebook has — the length of each row is nobody's
   job but this file's. Without it, one document could carry a megabyte of text
   into every member's browser and still be perfectly well-formed to the rules. */

const clip = (v, max, fb = '') => {
  const s = str(v, fb).trim();
  return s.length > max ? s.slice(0, max) : s;
};

const GUIDE = {
  sections: 20, tips: 12, phrases: 60, emergency: 20,
  title: 120, tip: 400, phrase: 200, label: 120, value: 120,
};

function cleanSection(raw) {
  if (!isObj(raw)) return null;
  const title = clip(raw.title, GUIDE.title);
  const tips = arr(raw.tips).map((t) => clip(t, GUIDE.tip)).filter(Boolean).slice(0, GUIDE.tips);
  if (!title && !tips.length) return null;
  return { title: title || 'Ghi chú', tips };
}

/* A phrase is only useful if it has both sides of it: the Vietnamese the
   person means and the local text they can point at. `roman` is the reading
   aid and may legitimately be missing for a language written in Latin script. */
function cleanPhraseRow(raw) {
  if (!isObj(raw)) return null;
  const vi = clip(raw.vi, GUIDE.phrase);
  const local = clip(raw.local, GUIDE.phrase);
  if (!vi || !local) return null;
  return { vi, local, roman: clip(raw.roman, GUIDE.phrase) };
}

function cleanContact(raw) {
  if (!isObj(raw)) return null;
  const label = clip(raw.label, GUIDE.label);
  const value = clip(raw.value, GUIDE.value);
  if (!label || !value) return null;
  return { label, value };
}

/** One destination's guidebook. Null when there is nothing worth showing. */
export function cleanGuide(raw) {
  if (!isObj(raw)) return null;
  const sections = arr(raw.sections).map(cleanSection).filter(Boolean).slice(0, GUIDE.sections);
  const phrases = arr(raw.phrases).map(cleanPhraseRow).filter(Boolean).slice(0, GUIDE.phrases);
  const emergency = arr(raw.emergency).map(cleanContact).filter(Boolean).slice(0, GUIDE.emergency);
  // an empty guidebook is worse than none: it looks generated and says nothing
  if (!sections.length && !phrases.length) return null;
  return {
    dest: clip(raw.dest, 200),
    lang: clip(raw.lang, 100),
    currency: clip(raw.currency, 200),
    summary: clip(raw.summary, 2000),
    sections,
    phrases,
    emergency,
    createdAt: num(raw.createdAt, 0),
  };
}

/** One translated line, from the model or from this device's cache. */
export function cleanTranslation(raw) {
  if (!isObj(raw)) return null;
  const source = clip(raw.source, GUIDE.phrase);
  const text = clip(raw.text, GUIDE.phrase);
  if (!source || !text) return null;
  return {
    source,
    text,
    roman: clip(raw.roman, GUIDE.phrase),
    literal: clip(raw.literal, GUIDE.phrase),
    note: clip(raw.note, GUIDE.tip),
    target: clip(raw.target, 100),
    createdAt: num(raw.createdAt, 0),
  };
}
