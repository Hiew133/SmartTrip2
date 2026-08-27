import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { SEED_DAYS, SEED_EXPENSES, SEED_MEMBERS } from './data.js';

const LS_KEY = 'smarttrip-v1';

const defaultState = {
  screen: 'login',           // login | trips | trip | ai
  auth: 'in',                // login screen: in | up
  showEnglish: true,

  // trip detail
  tripTab: 'itin',           // itin | budget | members
  day: 0,
  focusIdx: -1,
  days: SEED_DAYS,
  expenses: SEED_EXPENSES,
  members: SEED_MEMBERS,
  settled: {},

  // expense dialog
  showAdd: false,
  draftName: '', draftAmt: '', draftPayer: 0, draftCat: 'Ăn uống',

  // members
  inviteEmail: '', inviteRole: 'edit', copied: false,

  // AI desk
  aiPhase: 'form',           // form | loading | result
  aiDest: 'Đà Nẵng – Hội An, Việt Nam',
  aiDate: '2026-09-12',
  aiBudget: '4.000.000 ₫',
  aiDaysN: 4,
  aiParty: 'Nhóm bạn',
  aiPace: 'Cân bằng',
  aiStyles: { 'Ẩm thực': true, 'Biển đảo': true },
};

// Only durable trip data is persisted; UI state resets each visit.
const PERSISTED = ['days', 'expenses', 'members', 'settled', 'showEnglish'];

function loadPersisted() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    if (!raw || typeof raw !== 'object') return {};
    return Object.fromEntries(Object.entries(raw).filter(([k]) => PERSISTED.includes(k)));
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
  }, [state.days, state.expenses, state.members, state.settled, state.showEnglish]);

  const api = useMemo(() => {
    const patch = (p) => setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
    const go = (screen, extra) => patch({ screen, ...extra });
    const notify = (msg, tone = 'accent') => patch({ toast: { msg, tone } });
    return { patch, go, notify };
  }, []);

  return <Ctx.Provider value={{ state, ...api }}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

/* Shared derived budget math: balances per core member and the minimal
   settle-up transfer list (greedy largest-debtor → largest-creditor). */
export function computeBudget(state) {
  const core = state.members.filter((m) => !m.pending);
  const total = state.expenses.reduce((s, e) => s + e.a, 0);
  const share = core.length ? total / core.length : 0;
  const paid = core.map((_, i) => state.expenses.reduce((s, e) => s + (e.p === i ? e.a : 0), 0));
  const bal = core.map((m, i) => ({ name: m.n.split(' ')[0], amt: paid[i] - share }));

  const debt = bal.filter((b) => b.amt < -0.5).map((b) => ({ n: b.name, a: -b.amt })).sort((a, b) => b.a - a.a);
  const cred = bal.filter((b) => b.amt > 0.5).map((b) => ({ n: b.name, a: b.amt })).sort((a, b) => b.a - a.a);
  const transfers = [];
  let di = 0, ci = 0;
  while (di < debt.length && ci < cred.length) {
    const x = Math.min(debt[di].a, cred[ci].a);
    transfers.push({ from: debt[di].n, to: cred[ci].n, a: x });
    debt[di].a -= x; cred[ci].a -= x;
    if (debt[di].a < 0.5) di++;
    if (cred[ci].a < 0.5) ci++;
  }
  return { core, total, share, bal, transfers };
}
