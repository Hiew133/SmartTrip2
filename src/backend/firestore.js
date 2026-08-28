import {
  collection, deleteDoc, doc, getDocs, onSnapshot, query, runTransaction,
  serverTimestamp, setDoc, updateDoc, where, writeBatch,
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

/* memberIds, roles and pendingEmails are denormalised off `members` purely so
   the security rules can answer "may this uid read/write?" without reading
   another document. They must be rebuilt every time members change.

   pendingEmails is what lets an invited person find the trip waiting for them
   before they are a member of it — see claimInvites below. */
const derive = (members) => {
  const seated = members.filter((m) => m.uid);
  return {
    memberIds: seated.map((m) => m.uid),
    roles: Object.fromEntries(seated.map((m) => [m.uid, m.role])),
    pendingEmails: members.filter((m) => !m.uid && m.email).map((m) => m.email.toLowerCase()),
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

  /* fromCache says the snapshot came from the local copy rather than the
     server. It matters after a permission error: Firestore keeps serving the
     last cached documents, and treating that as a fresh success would wipe the
     error message and leave stale trips on screen looking perfectly healthy. */
  let fromCache = true;
  const emit = () => cb(
    [...meta.keys()]
      .map((id) => cleanTrip({ ...meta.get(id), id, days: days.get(id) ?? [], expenses: expenses.get(id) ?? [] }))
      .filter(Boolean)
      .sort((a, b) => a.createdAt - b.createdAt),
    { fromCache },
  );

  /* Firestore kills a listener for good once it errors. A day or expense
     listener can fail the moment its trip is created — the rules read the
     parent trip, which the server may not consider readable yet — and the
     result was a trip whose days stayed empty until someone reloaded the page.
     So a failed sub-listener is dropped and re-attached a moment later, a few
     times, instead of being left dead. */
  const retries = new Map();
  const timers = new Set();

  const watch = (id) => {
    if (subs.has(id)) return;

    const retry = (err) => {
      fail(err);
      (subs.get(id) ?? []).forEach((u) => u());
      subs.delete(id);
      const n = (retries.get(id) ?? 0) + 1;
      retries.set(id, n);
      if (n > 3) return;                       // genuinely denied: stop asking
      const t = setTimeout(() => {
        timers.delete(t);
        if (meta.has(id)) watch(id);
      }, 400 * n);
      timers.add(t);
    };

    subs.set(id, [
      onSnapshot(daysRef(id), (snap) => {
        days.set(id, snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        emit();
      }, retry),
      onSnapshot(expensesRef(id), (snap) => {
        expenses.set(id, snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)));
        emit();
      }, retry),
    ]);
  };

  const unwatch = (id) => {
    (subs.get(id) ?? []).forEach((u) => u());
    subs.delete(id); meta.delete(id); days.delete(id); expenses.delete(id);
    retries.delete(id);
  };

  const unsubTrips = onSnapshot(q, (snap) => {
    fromCache = snap.metadata.fromCache;
    const live = new Set(snap.docs.map((d) => d.id));
    snap.docs.forEach((d) => { meta.set(d.id, d.data()); watch(d.id); });
    [...subs.keys()].forEach((id) => { if (!live.has(id)) unwatch(id); });
    emit();
  }, fail);

  return () => {
    unsubTrips();
    timers.forEach(clearTimeout);
    [...subs.keys()].forEach(unwatch);
  };
}

/* ── writes ─────────────────────────────────────────────────────────────── */

/* The trip document is written and committed on its own, before anything in its
   sub-collections. It cannot be one batch: the rules for days and expenses read
   the parent trip to find the caller's role, and inside a single batch that
   parent does not exist yet — every nested write comes back permission-denied.
   Creating an empty trip worked, creating one with days did not, which is what
   gave this away. */
export async function createTrip(user, trip) {
  const ref = doc(tripsRef());
  await setDoc(ref, tripDoc({ ...trip, ownerId: user.uid }));

  if (trip.days.length || trip.expenses.length) {
    const batch = writeBatch(db());
    trip.days.forEach((d, i) => batch.set(dayRef(ref.id, d.id), dayDoc(d, i)));
    trip.expenses.forEach((e) => batch.set(expenseRef(ref.id, e.id), expenseDoc(e)));
    await batch.commit();
  }
  return ref.id;
}

export async function updateTrip(tripId, fields) {
  const patch = { ...fields, updatedAt: serverTimestamp() };
  // members carry the access control, so never let them drift from the mirrors
  if (fields.members) Object.assign(patch, derive(fields.members));
  await updateDoc(tripRef(tripId), patch);
}

/* Firestore does not cascade, and the children have to go first — not for
   tidiness but because they become unreachable the moment the parent is gone:
   the rules for days and expenses `get()` the trip document to find the
   caller's role, and a get() on a deleted document returns null, so every
   later read, write and delete on the leftovers is denied for good. Deleting
   the trip first would strand its days and expenses in the project forever
   with no client able to touch them. */
export async function deleteTrip(tripId) {
  const [days, expenses] = await Promise.all([
    getDocs(daysRef(tripId)),
    getDocs(expensesRef(tripId)),
  ]);

  // one batch caps at 500 writes; a trip is nowhere near that, but a run of
  // several years of expenses should not be the thing that breaks deletion
  const children = [...days.docs, ...expenses.docs];
  for (let i = 0; i < children.length; i += 400) {
    const batch = writeBatch(db());
    children.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

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

/* An invitation only records an email — the invited person has no uid until
   they sign in. This runs right after sign-in and seats them: it finds every
   trip whose pendingEmails contains their address and fills in their uid.
   The rules pin this write down so it can only ever seat the caller.

   Firebase Auth must consider the address verified, which Google sign-in gives
   for free; an email/password account has to confirm the link first. */
export async function claimInvites(user) {
  const email = (user.email || '').toLowerCase();
  if (!email) return 0;
  /* The rules require a verified address, so for an unverified one this query
     is denied every single time. Skipping it keeps a red error out of the
     console on every sign-in; Trips shows the person what to do instead. */
  if (!user.emailVerified) return 0;

  const waiting = await getDocs(query(tripsRef(), where('pendingEmails', 'array-contains', email)));
  let claimed = 0;

  for (const found of waiting.docs) {
    // eslint-disable-next-line no-await-in-loop -- a handful of trips at most
    const ok = await runTransaction(db(), async (tx) => {
      const snap = await tx.get(tripRef(found.id));
      if (!snap.exists()) return false;
      const members = snap.data().members ?? [];
      let hit = false;
      const next = members.map((m) => {
        if (hit || m.uid || (m.email || '').toLowerCase() !== email) return m;
        hit = true;
        return { ...m, uid: user.uid, pending: false, name: m.name || user.name };
      });
      if (!hit) return false;
      tx.update(tripRef(found.id), { members: next, ...derive(next) });
      return true;
    });
    if (ok) claimed += 1;
  }
  return claimed;
}

const sameList = (a = [], b = []) => a.length === b.length && a.every((x) => b.includes(x));

/* pendingEmails was added after some trips had already been written, so their
   invitations were invisible to claimInvites. This repairs the mirrors on any
   trip the caller owns, once per sign-in. Idempotent: it only writes when the
   stored copy actually differs from what members implies. */
export async function repairMirrors(user) {
  const mine = await getDocs(query(tripsRef(), where('memberIds', 'array-contains', user.uid)));
  let fixed = 0;

  for (const found of mine.docs) {
    const data = found.data();
    if (data.roles?.[user.uid] !== 'owner') continue;      // only the owner may rewrite these
    const want = derive(data.members ?? []);
    if (sameList(want.pendingEmails, data.pendingEmails)
      && sameList(want.memberIds, data.memberIds)) continue;
    // eslint-disable-next-line no-await-in-loop -- a handful of trips at most
    await updateDoc(tripRef(found.id), { ...data, ...want });
    fixed += 1;
  }
  return fixed;
}

/* Taking somebody off the trip — an owner's job, and the one that cancels an
   invitation that was sent to the wrong address. Transactional for the same
   reason addMember is: two people editing the list at once would otherwise
   write whole arrays over each other. */
export async function removeMember(tripId, memberId) {
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(tripRef(tripId));
    if (!snap.exists()) return;
    const members = snap.data().members ?? [];
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    // a trip with no owner has nobody who can administer it
    if (target.role === 'owner') throw new Error('Không gỡ được chủ chuyến đi.');
    const next = members.filter((m) => m.id !== memberId);
    tx.update(tripRef(tripId), { members: next, ...derive(next), updatedAt: serverTimestamp() });
  });
}

/* Giving up your own seat. The rules allow exactly this shape and nothing
   else — see leavesOwnSeat — so the write has to touch only the member list
   and the two mirrors that follow from it. */
export async function leaveTrip(tripId, user) {
  await runTransaction(db(), async (tx) => {
    const snap = await tx.get(tripRef(tripId));
    if (!snap.exists()) return;
    const members = snap.data().members ?? [];
    const me = members.find((m) => m.uid === user.uid);
    if (!me) return;
    if (me.role === 'owner') throw new Error('Chủ chuyến không rời được chuyến đi của mình.');
    const next = members.filter((m) => m.id !== me.id);
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
