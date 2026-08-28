import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, first, newTrip } from './data.js';
import { firebaseEnabled, repo, subscribeAuth } from './backend/index.js';

const PREF_KEY = 'smarttrip-prefs';

const defaultState = {
  screen: 'login',           // login | trips | trip | ai
  auth: 'in',                // login screen: in | up
  showEnglish: true,

  // session
  user: null,
  authReady: false,
  readyForUid: null,
  dataError: '',

  // trip data (mirrored from the backend, never edited in place)
  trips: [],
  activeTripId: null,

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
  aiDraft: null,
  aiError: '',

  // transient toast — never persisted, safe to lose
  toast: null,
};

/* Trip data lives in the backend now; localStorage only keeps the one thing
   that is a per-device preference rather than shared trip content. */
function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY));
    return typeof raw?.showEnglish === 'boolean' ? { showEnglish: raw.showEnglish } : {};
  } catch {
    return {};
  }
}

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState(() => ({ ...defaultState, ...loadPrefs() }));
  /* Actions are created once and need the current state; a ref updated after
     each commit is the supported way to read it without re-creating them. */
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ showEnglish: state.showEnglish })); } catch { /* quota */ }
  }, [state.showEnglish]);

  /* ── session ─────────────────────────────────────────────────────────── */
  useEffect(() => subscribeAuth((user) => setState((s) => ({
    ...s,
    user,
    authReady: true,
    // land on the trip list after signing in, and back on login after signing out
    screen: user ? (s.screen === 'login' ? 'trips' : s.screen) : 'login',
    ...(user ? {} : { trips: [], activeTripId: null, readyForUid: null }),
  }))), []);

  /* ── live trip data ──────────────────────────────────────────────────── */
  const uidKey = state.user?.uid ?? null;

  /* An invitation only carries an email until the invited person signs in.
     Seat them the moment they do, so the trip simply appears in their list. */
  useEffect(() => {
    if (!uidKey) return;
    const me = stateRef.current.user;
    repo.claimInvites(me)
      .then((n) => {
        if (n > 0) {
          setState((s) => ({
            ...s,
            toast: { msg: `Đã vào ${n} chuyến đi bạn được mời`, tone: 'sage' },
          }));
        }
      })
      .catch((err) => console.error('SmartTrip · nhận lời mời:', err));
  }, [uidKey]);

  useEffect(() => {
    if (!uidKey) return undefined;
    return repo.subscribeTrips(
      stateRef.current.user,
      (trips, { fromCache } = {}) => setState((s) => ({
        ...s,
        trips,
        readyForUid: uidKey,
        // a cached snapshot is not proof the problem went away
        dataError: fromCache ? s.dataError : '',
        // the open trip can be deleted by someone else mid-session
        activeTripId: trips.some((t) => t.id === s.activeTripId) ? s.activeTripId : (trips[0]?.id ?? null),
      })),
      (err) => setState((s) => ({
        ...s,
        readyForUid: uidKey,
        dataError: err?.code === 'permission-denied'
          ? 'Không đọc được dữ liệu. Nếu vừa bật App Check, đăng ký debug token cho máy này; nếu không thì kiểm tra Security Rules.'
          : 'Không tải được dữ liệu chuyến đi. Kiểm tra kết nối rồi tải lại trang.',
      })),
    );
  }, [uidKey]);

  const api = useMemo(() => {
    const patch = (p) => setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
    const go = (screen, extra) => patch({ screen, ...extra });
    const notify = (msg, tone = 'accent') => patch({ toast: { msg, tone } });

    const current = () => {
      const s = stateRef.current;
      return s.trips.find((t) => t.id === s.activeTripId) ?? null;
    };

    /* Every write goes through here so one failed round-trip cannot leave the
       person staring at a UI that silently did nothing. */
    const run = async (label, fn) => {
      try {
        return await fn();
      } catch (err) {
        console.error(`SmartTrip · ${label}:`, err);
        notify(err?.code === 'permission-denied'
          ? 'Bạn chỉ có quyền Xem trong chuyến đi này.'
          : `Không lưu được: ${label}. Thử lại giúp mình.`, 'neutral');
        return null;
      }
    };

    const onTrip = (label, fn) => {
      const trip = current();
      if (!trip) return Promise.resolve(null);
      return run(label, () => fn(trip.id, trip));
    };

    const actions = {
      createTrip: async (over = {}, { open = true } = {}) => {
        const s = stateRef.current;
        if (!s.user) return null;
        const base = newTrip({ ownerId: s.user.uid, createdAt: Date.now(), ...over });
        /* Whoever creates the trip owns it. The owner seat keeps its id so any
           expenses copied in alongside it still point at a real payer; only
           the identity on that seat is replaced. */
        const ownerIdx = Math.max(0, base.members.findIndex((m) => m.role === 'owner'));
        base.members = base.members.map((m, i) => (i === ownerIdx
          ? { ...m, role: 'owner', pending: false, uid: s.user.uid, name: s.user.name || m.name, email: s.user.email || m.email }
          : { ...m, uid: null }));

        const id = await run('tạo chuyến đi', () => repo.createTrip(s.user, base));
        if (id && open) go('trip', { activeTripId: id, tripTab: 'itin', day: 0, focusIdx: -1 });
        return id;
      },
      updateTrip: (fields) => onTrip('cập nhật chuyến đi', (id) => repo.updateTrip(id, fields)),
      deleteTrip: () => onTrip('xoá chuyến đi', (id) => repo.deleteTrip(id)),

      addDay: (day) => onTrip('thêm ngày', (id) => repo.addDay(id, day)),
      updateDay: (dayId, fields) => onTrip('sửa ngày', (id) => repo.updateDay(id, dayId, fields)),
      removeDay: (dayId) => onTrip('xoá ngày', (id) => repo.removeDay(id, dayId)),

      addExpense: (expense) => onTrip('thêm khoản chi', (id) => repo.addExpense(id, expense)),
      updateExpense: (expId, fields) => onTrip('sửa khoản chi', (id) => repo.updateExpense(id, expId, fields)),
      removeExpense: (expId) => onTrip('xoá khoản chi', (id) => repo.removeExpense(id, expId)),

      setSettled: (settled) => onTrip('đánh dấu đã trả', (id) => repo.setSettled(id, settled)),
      addMember: (member) => onTrip('gửi lời mời', (id) => repo.addMember(id, member)),
      setMemberRole: (memberId, role) => onTrip('đổi quyền', (id) => repo.setMemberRole(id, memberId, role)),
    };

    return { patch, go, notify, actions };
  }, []);

  return <Ctx.Provider value={{ state, ...api }}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

/** True once the backend has delivered the trip list for the signed-in user.
 *  Derived rather than stored, so it can never be left true for the wrong uid. */
export const useTripsReady = () => {
  const { state } = useApp();
  return state.readyForUid !== null && state.readyForUid === (state.user?.uid ?? null);
};

/** The open trip, or null when the account has none yet. */
export const useActiveTrip = () => {
  const { state } = useApp();
  return state.trips.find((t) => t.id === state.activeTripId) ?? null;
};

/** What the signed-in user may do in the open trip. */
export function useTripRole(trip) {
  const { state } = useApp();
  if (!trip || !state.user) return 'view';
  const me = trip.members.find((m) => m.uid === state.user.uid);
  // demo mode has no real identities, so it never locks anyone out
  if (!me) return firebaseEnabled ? 'view' : 'owner';
  return me.role;
}

export const canEdit = (role) => role === 'owner' || role === 'edit';

/* Shared derived budget math: balances per core member and the minimal
   settle-up transfer list (greedy largest-debtor → largest-creditor). */
export function computeBudget(trip) {
  if (!trip) return { core: [], total: 0, share: 0, bal: [], transfers: [] };
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
