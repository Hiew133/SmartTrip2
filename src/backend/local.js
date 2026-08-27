import { SEED_TRIPS } from '../data.js';
import { cleanTrips, isObj } from './schema.js';

/* Demo backend: the same repository interface as firestore.js, kept entirely
   in localStorage. This is what runs before anyone attaches a Firebase
   project, so the app is never a blank screen waiting on credentials. */

export const LS_KEY = 'smarttrip-v2';

const listeners = new Set();
let trips = null;

function load() {
  if (trips) return trips;
  let stored = null;
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    stored = isObj(raw) ? cleanTrips(raw.trips) : null;
  } catch { /* corrupt or private mode — fall through to the seed */ }

  if (stored) {
    trips = stored;
  } else {
    /* Write the seed out immediately. Leaving it in memory only meant the demo
       looked persistent until the first reload, and that a trip deleted before
       any other edit came straight back. */
    trips = cleanTrips(SEED_TRIPS);
    save();
  }
  return trips;
}

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ trips })); } catch { /* quota */ }
}

function commit(next) {
  trips = next;
  save();
  listeners.forEach((cb) => cb(trips));
}

const edit = (tripId, fn) => commit(trips.map((t) => (t.id === tripId ? fn(t) : t)));

export function subscribeTrips(user, cb) {
  cb(load());
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function createTrip(user, trip) {
  commit([...load(), trip]);
  return trip.id;
}

export async function updateTrip(tripId, fields) {
  edit(tripId, (t) => ({ ...t, ...fields }));
}

export async function deleteTrip(tripId) {
  commit(load().filter((t) => t.id !== tripId));
}

export async function addDay(tripId, day) {
  edit(tripId, (t) => ({ ...t, days: [...t.days, day] }));
}

export async function updateDay(tripId, dayId, fields) {
  edit(tripId, (t) => ({ ...t, days: t.days.map((d) => (d.id === dayId ? { ...d, ...fields } : d)) }));
}

export async function removeDay(tripId, dayId) {
  edit(tripId, (t) => ({ ...t, days: t.days.filter((d) => d.id !== dayId) }));
}

export async function addExpense(tripId, expense) {
  edit(tripId, (t) => ({ ...t, expenses: [...t.expenses, expense] }));
}

export async function updateExpense(tripId, expenseId, fields) {
  edit(tripId, (t) => ({
    ...t, expenses: t.expenses.map((e) => (e.id === expenseId ? { ...e, ...fields } : e)),
  }));
}

export async function removeExpense(tripId, expenseId) {
  edit(tripId, (t) => ({ ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) }));
}

export async function setSettled(tripId, settled) {
  edit(tripId, (t) => ({ ...t, settled }));
}

export async function addMember(tripId, member) {
  edit(tripId, (t) => ({ ...t, members: [...t.members, member] }));
}

export async function setMemberRole(tripId, memberId, role) {
  edit(tripId, (t) => ({
    ...t, members: t.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
  }));
}
