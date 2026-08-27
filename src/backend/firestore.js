import {
  collection, deleteDoc, doc, onSnapshot, query, runTransaction,
  serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { cleanTrip } from './schema.js';

/* Firestore layout
   ────────────────
   trips/{tripId}                    metadata, members, settle-up marks
   trips/{tripId}/days/{dayId}       one doc per day, stops inline as `items`
   trips/{tripId}/expenses/{expId}   one doc per expense

   Days keep their stops inline because every stop edit here rewrites the whole
   day anyway (drag-to-reorder, optimise route) — a stops subcollection would
   turn one write into N. Expenses get their own docs because that is the list
   several people add to at the same time, and per-doc writes stop them from
   overwriting each other. */

const tripsRef = () => collection(db(), 'trips');
const tripRef = (id) => doc(db(), 'trips', id);
const daysRef = (tripId) => collection(db(), 'trips', tripId, 'days');
const dayRef = (tripId, dayId) => doc(db(), 'trips', tripId, 'days', dayId);
const expensesRef = (tripId) => collection(db(), 'trips', tripId, 'expenses');
const expenseRef = (tripId, id) => doc(db(), 'trips', tripId, 'expenses', id);

/* memberIds and roles are denormalised off `members` purely so the security
   rules can answer "may this uid read/write?" without reading another
   document. They must be rebuilt every time members change. */
const derive = (members) => {
  const seated = members.filter((m) => m.uid);
  return {
    memberIds: seated.map((m) => m.uid),
    roles: Object.fromEntries(seated.map((m) => [m.uid, m.role])),
  };
};

const tripDoc = (trip) => ({
  title: trip.title,
  seed: trip.seed,
  alt: trip.alt,
  body: trip.body,
  startDate: trip.startDate ?? null,
  endDate: trip.endDate ?? null,
  plan: trip.plan ?? 0,
  members: trip.members,
  settled: trip.settled ?? {},
  ownerId: trip.ownerId ?? null,
  createdAt: trip.createdAt || Date.now(),
  updatedAt: serverTimestamp(),
  ...derive(trip.members),
});

const dayDoc = (day, order) => ({
  place: day.place ?? '', seed: day.seed ?? '', items: day.items ?? [], order,
});

const expenseDoc = (e) => ({
  name: e.name, cat: e.cat, payerId: e.payerId, amount: e.amount,
  createdAt: e.createdAt || Date.now(),
});

/* ── reads ──────────────────────────────────────────────────────────────── */

/** Live view of every trip this user belongs to, assembled from three
 *  collections. Returns an unsubscribe that also tears down the per-trip
 *  listeners it opened. */
export function subscribeTrips(user, cb, onError) {
  const q = query(tripsRef(), where('memberIds', 'array-contains', user.uid));

  const meta = new Map();
  const days = new Map();
  const expenses = new Map();
  const subs = new Map();

  const fail = (err) => { console.error('SmartTrip · Firestore:', err); onError?.(err); };

  const emit = () => cb(
    [...meta.keys()]
      .map((id) => cleanTrip({ ...meta.get(id), id, days: days.get(id) ?? [], expenses: expenses.get(id) ?? [] }))
      .filter(Boolean)
      .sort((a, b) => a.createdAt - b.createdAt),
  );

  const watch = (id) => {
    if (subs.has(id)) return;
    subs.set(id, [
      onSnapshot(daysRef(id), (snap) => {
        days.set(id, snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        emit();
      }, fail),
      onSnapshot(expensesRef(id), (snap) => {
        expenses.set(id, snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)));
        emit();
      }, fail),
    ]);
  };

  const unwatch = (id) => {
    (subs.get(id) ?? []).forEach((u) => u());
    subs.delete(id); meta.delete(id); days.delete(id); expenses.delete(id);
  };

  const unsubTrips = onSnapshot(q, (snap) => {
    const live = new Set(snap.docs.map((d) => d.id));
    snap.docs.forEach((d) => { meta.set(d.id, d.data()); watch(d.id); });
    [...subs.keys()].forEach((id) => { if (!live.has(id)) unwatch(id); });
    emit();
  }, fail);

  return () => { unsubTrips(); [...subs.keys()].forEach(unwatch); };
}

/* ── writes ─────────────────────────────────────────────────────────────── */

export async function createTrip(user, trip) {
  const ref = doc(tripsRef());
  const batch = writeBatch(db());
  batch.set(ref, tripDoc({ ...trip, ownerId: user.uid }));
  trip.days.forEach((d, i) => batch.set(dayRef(ref.id, d.id), dayDoc(d, i)));
  trip.expenses.forEach((e) => batch.set(expenseRef(ref.id, e.id), expenseDoc(e)));
  await batch.commit();
  return ref.id;
}

export async function updateTrip(tripId, fields) {
  const patch = { ...fields, updatedAt: serverTimestamp() };
  // members carry the access control, so never let them drift from the mirrors
  if (fields.members) Object.assign(patch, derive(fields.members));
  await updateDoc(tripRef(tripId), patch);
}

export async function deleteTrip(tripId) {
  await deleteDoc(tripRef(tripId));
}

export async function addDay(tripId, day) {
  const batch = writeBatch(db());
  batch.set(dayRef(tripId, day.id), dayDoc(day, Date.now()));
  batch.update(tripRef(tripId), { updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function updateDay(tripId, dayId, fields) {
  await updateDoc(dayRef(tripId, dayId), fields);
}

export async function removeDay(tripId, dayId) {
  await deleteDoc(dayRef(tripId, dayId));
}

export async function addExpense(tripId, expense) {
  const batch = writeBatch(db());
  batch.set(expenseRef(tripId, expense.id), expenseDoc(expense));
  batch.update(tripRef(tripId), { updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function updateExpense(tripId, expenseId, fields) {
  await updateDoc(expenseRef(tripId, expenseId), fields);
}

export async function removeExpense(tripId, expenseId) {
  await deleteDoc(expenseRef(tripId, expenseId));
}

export async function setSettled(tripId, settled) {
  await updateDoc(tripRef(tripId), { settled, updatedAt: serverTimestamp() });
}

/* Member changes run in a transaction: two people inviting at once would
   otherwise write whole arrays over each other, and one invite would vanish. */
export async function addMember(tripId, member) {
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(tripRef(tripId));
    if (!snap.exists()) throw new Error('Chuyến đi không còn tồn tại.');
    const members = snap.data().members ?? [];
    if (members.some((m) => m.email?.toLowerCase() === member.email.toLowerCase())) return;
    const next = [...members, member];
    tx.update(tripRef(tripId), { members: next, ...derive(next), updatedAt: serverTimestamp() });
  });
}

export async function setMemberRole(tripId, memberId, role) {
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(tripRef(tripId));
    if (!snap.exists()) return;
    const next = (snap.data().members ?? []).map((m) => (m.id === memberId ? { ...m, role } : m));
    tx.update(tripRef(tripId), { members: next, ...derive(next), updatedAt: serverTimestamp() });
  });
}
