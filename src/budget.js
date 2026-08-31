/* Money math for a trip: who paid what, who owes whom, and which of those
   debts have been marked settled.

   This lives outside store.jsx on purpose. It is the part of the app most
   likely to be quietly wrong — an off-by-one in the split shows up as real
   money — and store.jsx carries JSX, so anything in there is out of reach of
   a plain `node --test` run. Pure functions, no React, no backend. */

import { first } from './data.js';

/**
 * Balances per seated member plus the transfers that clear them.
 *
 * Only non-pending members share the cost: someone who has been invited but
 * never signed in has not agreed to anything yet, and dividing by them would
 * understate what everybody else actually owes.
 */
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

  /* Greedy largest-debtor → largest-creditor. Usually lands on n−1 transfers,
     which is what people actually want; it is not guaranteed minimal, and the
     UI does not claim it is. The half-đồng thresholds keep rounding dust from
     producing a "0 ₫" transfer nobody can act on. */
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
