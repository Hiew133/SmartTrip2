import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CATEGORIES, SEED_TRIPS, first, uid } from './data.js';

export const LS_KEY = 'smarttrip-v2';

const defaultState = {
  screen: 'login',           // login | trips | trip | ai | mobile
  auth: 'in',                // login screen: in | up
  showEnglish: true,

  // trip data
  trips: SEED_TRIPS,
  activeTripId: SEED_TRIPS[0].id,

  // trip detail
  tripTab: 'itin',           // itin | budget | members
  day: 0,
  focusIdx: -1,

  // expense dialog
  showAdd: false,
  editingExpenseId: null,
  draftName: '', draftAmt: '', draftPayerId: null, draftCat: CATEGORIES[2],

  // members
  inviteEmail: '', inviteRole: 'edit', copied: false, copyErr: '',

  // AI desk
  aiPhase: 'form',           // form | loading | result
  aiDest: 'Đà Nẵng – Hội An, Việt Nam',
  aiDate: '2026-09-12',
  aiBudget: '4.000.000 ₫',
  aiDaysN: 4,
  aiParty: 'Nhóm bạn',
  aiPace: 'Cân bằng',
  aiStyles: { 'Ẩm thực': true, 'Biển đảo': true },

  // mobile companion
  mTab: 'itin', mDay: 0, mFocus: -1,
};

// Only durable trip data is persisted; UI state resets each visit.
const PERSISTED = ['trips', 'activeTripId', 'showEnglish'];

/* ── persisted-shape validation ──────────────────────────────────────────
   Anything read back from localStorage is treated as untrusted: a payload
   written by an older build, a half-finished write, or a hand-edited entry
   used to take the whole app down with no way back (the bad value was still
   there on the next reload). Every field is coerced to something the UI can
   render, and a trip that cannot be repaired is dropped rather than crashed on. */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v, fb = '') => (typeof v === 'string' ? v : fb);
const num = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb);
const coord = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const iso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function cleanStop(raw) {
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

function cleanDay(raw) {
  if (!isObj(raw)) return null;
  return {
    id: str(raw.id) || uid('day'),
    place: str(raw.place, ''),
    seed: str(raw.seed, ''),
    items: arr(raw.items).map(cleanStop).filter(Boolean),
  };
}

function cleanMember(raw) {
  if (!isObj(raw)) return null;
  const email = str(raw.email);
  if (!email) return null;
  return {
    id: str(raw.id) || uid('mem'),
    name: str(raw.name) || email.split('@')[0],
    email,
    role: ['owner', 'edit', 'view'].includes(raw.role) ? raw.role : 'view',
    pending: raw.pending === true,
  };
}

function cleanTrip(raw) {
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
  };
}

function loadPersisted() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    if (!isObj(raw)) return {};
    const trips = arr(raw.trips).map(cleanTrip).filter(Boolean);
    if (!trips.length) return {};            // nothing usable ⇒ fall back to the seed
    return {
      trips,
      activeTripId: trips.some((t) => t.id === raw.activeTripId) ? raw.activeTripId : trips[0].id,
      showEnglish: typeof raw.showEnglish === 'boolean' ? raw.showEnglish : defaultState.showEnglish,
    };
  } catch {
    return {};
  }
}

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(() => ({ ...defaultState, ...loadPersisted() }));

  useEffect(() => {
    const out = Object.fromEntries(PERSISTED.map((k) => [k, state[k]]));
    try { localStorage.setItem(LS_KEY, JSON.stringify(out)); } catch { /* quota/private mode */ }
    // PERSISTED is the single source of truth for what gets written *and* watched,
    // so adding a key to it can never leave the effect silently out of date.
  }, PERSISTED.map((k) => state[k])); // eslint-disable-line react-hooks/exhaustive-deps

  const api = useMemo(() => {
    const patch = (p) => setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
    const go = (screen, extra) => patch({ screen, ...extra });
    /** Update the open trip. `fn(trip, state)` returns the fields to merge. */
    const patchTrip = (fn) => patch((s) => ({
      trips: s.trips.map((t) => (t.id === s.activeTripId ? { ...t, ...fn(t, s) } : t)),
    }));
    return { patch, go, patchTrip };
  }, []);

  return <Ctx.Provider value={{ state, ...api }}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

/** The open trip. Never undefined: validation guarantees at least one trip. */
export const useActiveTrip = () => {
  const { state } = useApp();
  return state.trips.find((t) => t.id === state.activeTripId) ?? state.trips[0];
};

/* Shared derived budget math: balances per core member and the minimal
   settle-up transfer list (greedy largest-debtor → largest-creditor). */
export function computeBudget(trip) {
  const core = trip.members.filter((m) => !m.pending);
  const total = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const share = core.length ? total / core.length : 0;

  const paid = new Map(core.map((m) => [m.id, 0]));
  trip.expenses.forEach((e) => {
    if (paid.has(e.payerId)) paid.set(e.payerId, paid.get(e.payerId) + e.amount);
  });
  const bal = core.map((m) => ({ id: m.id, name: first(m.name), amt: paid.get(m.id) - share }));

  const debt = bal.filter((b) => b.amt < -0.5).map((b) => ({ ...b, a: -b.amt })).sort((x, y) => y.a - x.a);
  const cred = bal.filter((b) => b.amt > 0.5).map((b) => ({ ...b, a: b.amt })).sort((x, y) => y.a - x.a);
  const transfers = [];
  let di = 0, ci = 0;
  while (di < debt.length && ci < cred.length) {
    const x = Math.min(debt[di].a, cred[ci].a);
    transfers.push({ fromId: debt[di].id, toId: cred[ci].id, from: debt[di].name, to: cred[ci].name, a: x });
    debt[di].a -= x; cred[ci].a -= x;
    if (debt[di].a < 0.5) di++;
    if (cred[ci].a < 0.5) ci++;
  }
  return { core, total, share, bal, transfers };
}

/* A settle-up mark belongs to one exact transfer, so the amount is part of the
   key: add or remove an expense and the transfer it referred to no longer
   exists, which is the honest answer — the old "paid" flag used to survive and
   silently re-label a different, larger debt as already settled. */
export const settleKey = (t) => `${t.fromId}>${t.toId}:${Math.round(t.a)}`;

/** Toggle one transfer, dropping marks whose transfer is no longer on the list. */
export function toggleSettled(settled, transfers, key) {
  const live = new Set(transfers.map(settleKey));
  const next = {};
  Object.keys(settled).forEach((k) => { if (live.has(k)) next[k] = true; });
  if (next[key]) delete next[key]; else next[key] = true;
  return next;
}
