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
const coord = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const iso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export function cleanStop(raw) {
  if (!isObj(raw)) return null;
  return {
    id: str(raw.id) || uid('stop'),
    time: /^\d{1,2}:\d{2}$/.test(raw.time) ? raw.time : '--:--',
    name: str(raw.name, 'Điểm dừng'),
    note: str(raw.note, ''),
    cost: Math.max(0, num(raw.cost, 0)),
    lat: coord(raw.lat),
    lng: coord(raw.lng),
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
