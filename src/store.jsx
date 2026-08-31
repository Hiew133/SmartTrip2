import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, newTrip } from './data.js';
import { firebaseEnabled, refreshUser, repo, subscribeAuth } from './backend/index.js';

const PREF_KEY = 'smarttrip-prefs';

/* repairMirrors is a one-time migration for trips written before pendingEmails
   existed. Every write since goes through derive(), so once it has run for an
   account there is nothing left for it to find — and running it again means a
   full scan of the trip collection on *every* sign-in, for nothing. The flag
   is per device and per account; a failure leaves it unset so the next sign-in
   tries again. */
const REPAIR_KEY = 'smarttrip-mirrors-repaired';

const repairDone = (uid) => {
  try {
    return (JSON.parse(localStorage.getItem(REPAIR_KEY)) ?? []).includes(uid);
  } catch {
    return false;                     // private mode, or a value we did not write
  }
};

const markRepairDone = (uid) => {
  try {
    const seen = JSON.parse(localStorage.getItem(REPAIR_KEY)) ?? [];
    if (!seen.includes(uid)) localStorage.setItem(REPAIR_KEY, JSON.stringify([...seen, uid]));
  } catch { /* it just runs once more next time */ }
};

/* Share links look like /t/{tripId}. There is no router — the app is one
   screen stack driven by state — so the path is read once at boot and kept as
   an intent to act on later: the trip list has not arrived yet, and the person
   may not even be signed in. Hosting rewrites every path to index.html, so
   landing here is a normal cold start with a different pathname. */
function readSharedTripId() {
  try {
    const m = /^\/t\/([A-Za-z0-9_-]{1,64})\/?$/.exec(window.location.pathname);
    return m ? m[1] : null;
  } catch {
    return null;                      // no window (SSR) or an exotic URL
  }
}

const defaultState = {
  screen: 'login',           // login | trips | trip | ai | profile
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
  // a trip id from a /t/{id} share link, waiting for the list to arrive
  pendingTripId: readSharedTripId(),

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

  /* Two housekeeping jobs at sign-in: seat this person in any trip that was
     waiting for their email, and repair trips written before pendingEmails
     existed so their invitations become findable at all. */
  useEffect(() => {
    if (!uidKey) return;
    const me = stateRef.current.user;
    if (!repairDone(uidKey)) {
      repo.repairMirrors(me)
        .then(() => markRepairDone(uidKey))
        .catch((err) => console.error('SmartTrip · vá dữ liệu chuyến đi:', err));
    }
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
      (trips, { fromCache } = {}) => {
        /* A share link is answered here rather than in an effect of its own:
           this is already the callback where data arrives from outside, and a
           cached snapshot is not enough to conclude the trip is out of reach —
           it may simply not have been fetched yet. */
        const wanted = stateRef.current.pendingTripId;
        const settle = wanted && !fromCache;
        const open = settle && trips.some((t) => t.id === wanted) ? wanted : null;
        if (settle) {
          // the link has been spent; a reload should not chase it again
          try { window.history.replaceState(null, '', '/'); } catch { /* file:// */ }
        }

        setState((s) => ({
          ...s,
          trips,
          readyForUid: uidKey,
          // a cached snapshot is not proof the problem went away
          dataError: fromCache ? s.dataError : '',
          // the open trip can be deleted by someone else mid-session
          activeTripId: trips.some((t) => t.id === s.activeTripId) ? s.activeTripId : (trips[0]?.id ?? null),
          ...(settle ? { pendingTripId: null } : {}),
          ...(open ? { screen: 'trip', activeTripId: open, tripTab: 'itin', day: 0, focusIdx: -1 } : {}),
          /* Not being able to see it is the normal case for a link forwarded
             to someone who was never invited, so it is a note, not an error. */
          ...(settle && !open ? {
            toast: {
              msg: 'Liên kết trỏ tới một chuyến đi bạn chưa có quyền xem. Nhờ chủ chuyến mời email của bạn.',
              tone: 'neutral',
            },
          } : {}),
        }));
      },
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

      /* Navigates on the way out, the way createTrip navigates on the way in:
         the screen it was deleted from no longer has anything to show. The
         flag matters because run() answers null for a failure, and a bare
         `await repo.deleteTrip()` answers undefined for a success. */
      deleteTrip: async () => {
        const ok = await onTrip('xoá chuyến đi', async (id) => {
          await repo.deleteTrip(id);
          return true;
        });
        if (ok === true) {
          go('trips', { activeTripId: null, focusIdx: -1 });
          notify('Đã xoá chuyến đi', 'neutral');
        }
        return ok === true;
      },

      // a new day goes on the end; the store is what knows where the end is
      addDay: (day) => onTrip('thêm ngày', (id, trip) => repo.addDay(id, day, trip.days.length)),
      updateDay: (dayId, fields) => onTrip('sửa ngày', (id) => repo.updateDay(id, dayId, fields)),
      /* Deleting leaves a hole in the numbering, and the next addDay picks its
         order from the day count — so without closing the hole, day 4 of a
         trip that once had five would collide with an existing order and the
         two would sort arbitrarily. Renumbering the survivors keeps `order`
         meaning exactly "index in the trip". */
      removeDay: (dayId) => onTrip('xoá ngày', async (id, trip) => {
        await repo.removeDay(id, dayId);
        const rest = trip.days.filter((d) => d.id !== dayId).map((d) => d.id);
        if (rest.length) await repo.reorderDays(id, rest);
      }),
      reorderDays: (orderedIds) => onTrip('đổi thứ tự ngày', (id) => repo.reorderDays(id, orderedIds)),

      addExpense: (expense) => onTrip('thêm khoản chi', (id) => repo.addExpense(id, expense)),
      updateExpense: (expId, fields) => onTrip('sửa khoản chi', (id) => repo.updateExpense(id, expId, fields)),
      removeExpense: (expId) => onTrip('xoá khoản chi', (id) => repo.removeExpense(id, expId)),

      /* Reload the session after the person clicks the verification link in
         their mail client — nothing else tells this tab it happened — and pick
         up any invitation that was waiting on it. */
      refreshUser: async () => {
        const before = stateRef.current.user;
        const fresh = await run('kiểm tra xác minh email', () => refreshUser());
        if (!fresh) return false;
        setState((s) => ({ ...s, user: fresh }));
        if (fresh.emailVerified && !before?.emailVerified) {
          const n = await run('nhận lời mời', () => repo.claimInvites(fresh));
          notify(n > 0 ? `Đã xác minh — vào được ${n} chuyến đi bạn được mời` : 'Đã xác minh email.', 'sage');
        }
        return fresh.emailVerified;
      },

      setSettled: (settled) => onTrip('đánh dấu đã trả', (id) => repo.setSettled(id, settled)),
      addMember: (member) => onTrip('gửi lời mời', (id) => repo.addMember(id, member)),
      setMemberRole: (memberId, role) => onTrip('đổi quyền', (id) => repo.setMemberRole(id, memberId, role)),
      /* Taking someone off the trip has to answer "what happens to the money
         they fronted?" first. Left alone, cleanTrip silently re-homes their
         expenses onto whichever member happens to be first in the list — the
         balances change and nobody is told. So the expenses move deliberately,
         and they move *before* the seat disappears: if the second write fails,
         the trip is merely mid-handover rather than quietly mis-attributed. */
      removeMember: (memberId, moveExpensesTo = null) => onTrip('gỡ thành viên', async (id, trip) => {
        const theirs = trip.expenses.filter((e) => e.payerId === memberId).map((e) => e.id);
        if (theirs.length && moveExpensesTo) await repo.reassignPayer(id, theirs, moveExpensesTo);
        await repo.removeMember(id, memberId);
      }),

      /* Leaving is the one member change you make to yourself, so like
         deleting a trip it ends with nothing left to look at. */
      leaveTrip: async () => {
        const me = stateRef.current.user;
        if (!me) return false;
        const ok = await onTrip('rời chuyến đi', async (id) => {
          await repo.leaveTrip(id, me);
          return true;
        });
        if (ok === true) {
          go('trips', { activeTripId: null, focusIdx: -1 });
          notify('Đã rời chuyến đi', 'neutral');
        }
        return ok === true;
      },
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
