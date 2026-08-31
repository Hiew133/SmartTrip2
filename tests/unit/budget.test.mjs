import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBudget, settleKey, toggleSettled } from '../../src/budget.js';

const member = (id, name, over = {}) => ({ id, name, email: `${id}@x.vn`, role: 'edit', pending: false, uid: id, ...over });
const expense = (id, payerId, amount) => ({ id, name: id, cat: 'Khác', payerId, amount });

const trip = (members, expenses) => ({ members, expenses, settled: {} });

test('an empty trip is all zeroes, not a crash', () => {
  const b = computeBudget(null);
  assert.deepEqual(b, { core: [], total: 0, share: 0, bal: [], transfers: [] });

  const empty = computeBudget(trip([member('a', 'An')], []));
  assert.equal(empty.total, 0);
  assert.equal(empty.share, 0);
  assert.deepEqual(empty.transfers, []);
});

test('one payer, three people: the other two each owe a third', () => {
  const b = computeBudget(trip(
    [member('a', 'An Nguyễn'), member('b', 'Bình Lê'), member('c', 'Chi Trần')],
    [expense('e1', 'a', 300000)],
  ));

  assert.equal(b.total, 300000);
  assert.equal(b.share, 100000);
  assert.deepEqual(b.bal.map((x) => x.amt), [200000, -100000, -100000]);
  assert.equal(b.transfers.length, 2);
  assert.ok(b.transfers.every((t) => t.toId === 'a' && t.a === 100000));
});

test('a pending member does not dilute the split', () => {
  /* Someone invited but never signed in has agreed to nothing. Counting them
     would understate what everybody present actually owes. */
  const b = computeBudget(trip(
    [member('a', 'An'), member('b', 'Bình'), member('p', 'Chưa vào', { pending: true, uid: null })],
    [expense('e1', 'a', 200000)],
  ));

  assert.equal(b.core.length, 2);
  assert.equal(b.share, 100000);
  assert.equal(b.transfers.length, 1);
  assert.equal(b.transfers[0].fromId, 'b');
});

test('an expense paid by someone outside the split still counts as spend', () => {
  // cleanTrip re-homes orphaned payers, but a pending payer is a real shape:
  // the money left the group even though that person is not sharing the cost.
  const b = computeBudget(trip(
    [member('a', 'An'), member('p', 'Chưa vào', { pending: true, uid: null })],
    [expense('e1', 'p', 100000)],
  ));

  assert.equal(b.total, 100000);
  assert.equal(b.share, 100000);
  assert.equal(b.bal[0].amt, -100000);   // An owes their share to nobody in the list
});

test('the greedy settle-up clears every balance', () => {
  const members = ['a', 'b', 'c', 'd'].map((id) => member(id, id.toUpperCase()));
  const b = computeBudget(trip(members, [
    expense('e1', 'a', 1000000),
    expense('e2', 'b', 400000),
    expense('e3', 'c', 40000),
  ]));

  const net = new Map(b.bal.map((x) => [x.id, x.amt]));
  b.transfers.forEach((t) => {
    net.set(t.fromId, net.get(t.fromId) + t.a);
    net.set(t.toId, net.get(t.toId) - t.a);
  });
  [...net.values()].forEach((v) => assert.ok(Math.abs(v) < 0.5, `dư ${v}`));
  assert.ok(b.transfers.length <= members.length - 1);
});

test('rounding dust never becomes a transfer', () => {
  // 100 ₫ across three people cannot divide evenly
  const b = computeBudget(trip(
    [member('a', 'A'), member('b', 'B'), member('c', 'C')],
    [expense('e1', 'a', 100)],
  ));
  assert.ok(b.transfers.every((t) => t.a > 0.5));
});

test('a settle mark is bound to the amount, so editing an expense voids it', () => {
  const members = [member('a', 'A'), member('b', 'B')];
  const before = computeBudget(trip(members, [expense('e1', 'a', 200000)]));
  const key = settleKey(before.transfers[0]);
  assert.equal(key, 'b>a:100000');

  const marked = toggleSettled({}, before.transfers, key);
  assert.deepEqual(marked, { 'b>a:100000': true });

  // the expense grows; the old transfer no longer exists
  const after = computeBudget(trip(members, [expense('e1', 'a', 500000)]));
  const stillLive = toggleSettled(marked, after.transfers, settleKey(after.transfers[0]));
  assert.equal(stillLive['b>a:100000'], undefined, 'dấu đã trả cũ phải hết hiệu lực');
  assert.equal(stillLive['b>a:250000'], true);
});

test('toggling twice returns to unmarked', () => {
  const b = computeBudget(trip([member('a', 'A'), member('b', 'B')], [expense('e1', 'a', 200000)]));
  const key = settleKey(b.transfers[0]);
  const on = toggleSettled({}, b.transfers, key);
  const off = toggleSettled(on, b.transfers, key);
  assert.deepEqual(off, {});
});
