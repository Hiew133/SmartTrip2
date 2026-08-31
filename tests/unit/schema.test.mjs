import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDay, cleanMember, cleanStop, cleanTrip, cleanTrips } from '../../src/backend/schema.js';

/* Everything read from localStorage, Firestore or the AI model goes through
   here. The contract is: never throw, never let a bad row through, and drop
   only what genuinely cannot be repaired. */

const owner = { id: 'm1', name: 'An', email: 'an@x.vn', role: 'owner', pending: false, uid: 'u1' };

test('junk in, null out — nothing throws', () => {
  [null, undefined, 42, 'chuỗi', [], true].forEach((junk) => {
    assert.equal(cleanTrip(junk), null);
    assert.equal(cleanDay(junk), null);
    assert.equal(cleanStop(junk), null);
    assert.equal(cleanMember(junk), null);
  });
  assert.deepEqual(cleanTrips(null), []);
  assert.deepEqual(cleanTrips('không phải mảng'), []);
});

test('a stop keeps real coordinates and nulls the unusable ones', () => {
  const ok = cleanStop({ id: 's1', time: '08:30', name: 'Mỹ Khê', cost: 40000, lat: 16.0611, lng: 108.2467 });
  assert.equal(ok.lat, 16.0611);
  assert.equal(ok.cost, 40000);

  const bad = cleanStop({ lat: 'mười sáu', lng: null });
  assert.equal(bad.lat, null);
  assert.equal(bad.lng, null);
  assert.equal(bad.name, 'Điểm dừng');
  assert.equal(bad.time, '--:--', 'giờ không đọc được thì hiện rõ là chưa có');
});

test('a stop can never carry a negative cost', () => {
  assert.equal(cleanStop({ cost: -5000 }).cost, 0);
  assert.equal(cleanStop({ cost: 'miễn phí' }).cost, 0);
});

test('a stop with no id gets one, so React keys stay stable', () => {
  const a = cleanStop({ name: 'x' });
  const b = cleanStop({ name: 'x' });
  assert.ok(a.id && b.id);
  assert.notEqual(a.id, b.id);
});

test('a member without an email is not a member', () => {
  assert.equal(cleanMember({ id: 'm', name: 'Không email' }), null);
  const m = cleanMember({ email: 'lan.pham@gmail.com' });
  assert.equal(m.name, 'lan.pham', 'thiếu tên thì lấy phần trước @');
  assert.equal(m.role, 'view', 'quyền lạ hoặc thiếu thì hạ xuống mức thấp nhất');
  assert.equal(m.uid, null);
});

test('an invented role is downgraded, never trusted', () => {
  assert.equal(cleanMember({ email: 'x@x.vn', role: 'admin' }).role, 'view');
  assert.equal(cleanMember({ email: 'x@x.vn', role: 'owner' }).role, 'owner');
});

test('a trip with no members is dropped, not rendered empty', () => {
  // there would be nobody to split money between, and no way to grant access
  assert.equal(cleanTrip({ title: 'Chuyến ma', members: [] }), null);
  assert.equal(cleanTrip({ title: 'Chuyến ma', members: [{ name: 'thiếu email' }] }), null);
});

test('a trip with members but no owner promotes the first one', () => {
  const t = cleanTrip({
    title: 'Không chủ',
    members: [{ email: 'a@x.vn', role: 'edit' }, { email: 'b@x.vn', role: 'view' }],
  });
  assert.equal(t.members[0].role, 'owner');
});

test('an expense pointing at a deleted member is re-homed, not lost', () => {
  /* An orphaned payerId used to vanish from the balances — the money simply
     stopped being owed to anyone. */
  const t = cleanTrip({
    title: 'Đà Nẵng',
    members: [owner],
    expenses: [{ id: 'e1', name: 'Vé', cat: 'Đi lại', payerId: 'người-đã-bị-gỡ', amount: 500000 }],
  });
  assert.equal(t.expenses.length, 1);
  assert.equal(t.expenses[0].payerId, 'm1');
  assert.equal(t.expenses[0].amount, 500000);
});

test('an expense keeps its payer when that payer still exists', () => {
  const second = { ...owner, id: 'm2', email: 'b@x.vn', role: 'edit', uid: 'u2' };
  const t = cleanTrip({
    title: 'x', members: [owner, second],
    expenses: [{ id: 'e1', payerId: 'm2', amount: 100 }],
  });
  assert.equal(t.expenses[0].payerId, 'm2');
});

test('an unknown expense category falls back to the last one', () => {
  const t = cleanTrip({ title: 'x', members: [owner], expenses: [{ id: 'e', cat: 'Bitcoin', amount: 1 }] });
  assert.equal(t.expenses[0].cat, 'Khác');
});

test('only real ISO dates survive', () => {
  const t = cleanTrip({ title: 'x', members: [owner], startDate: '2026-09-12', endDate: '12/09/2026' });
  assert.equal(t.startDate, '2026-09-12');
  assert.equal(t.endDate, null, 'định dạng khác bị bỏ, không đoán');
});

test('settled only keeps marks that are literally true', () => {
  const t = cleanTrip({
    title: 'x', members: [owner],
    settled: { 'a>b:100': true, 'c>d:200': false, 'e>f:300': 'true', 'g>h:400': 1 },
  });
  assert.deepEqual(t.settled, { 'a>b:100': true });
});

test('a broken trip in a list does not take the good ones down with it', () => {
  const list = cleanTrips([
    { title: 'Tốt', members: [owner] },
    null,
    { title: 'Hỏng', members: [] },
    { title: 'Cũng tốt', members: [owner] },
  ]);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((t) => t.title), ['Tốt', 'Cũng tốt']);
});

test('a day drops only the rows it cannot repair', () => {
  const d = cleanDay({ id: 'd1', place: 'Hội An', items: [{ name: 'ok' }, null, 7, { name: 'ok2' }] });
  assert.equal(d.items.length, 2);
  assert.deepEqual(d.items.map((s) => s.name), ['ok', 'ok2']);
});

test('a hand-added stop stays uncoordinated instead of landing at (0,0)', () => {
  /* Regression. newStop() writes lat: null, lng: null and that round-trips
     through the backend. Number(null) is 0 and 0 is finite, so the old coord()
     turned every such stop into latitude 0, longitude 0 — pinned in the Gulf
     of Guinea, and fed to the route optimiser as if it were a real place. */
  const s = cleanStop({ id: 's', name: 'Quán mới', lat: null, lng: null });
  assert.equal(s.lat, null);
  assert.equal(s.lng, null);

  ['', '   ', false, true, [], {}, undefined, NaN].forEach((junk) => {
    assert.equal(cleanStop({ lat: junk, lng: junk }).lat, null, `lat từ ${JSON.stringify(junk)}`);
  });
});

test('a coordinate outside the globe is refused, not passed to the map', () => {
  assert.equal(cleanStop({ lat: 91, lng: 10 }).lat, null);
  assert.equal(cleanStop({ lat: 10, lng: 181 }).lng, null);
  assert.equal(cleanStop({ lat: -90, lng: -180 }).lat, -90, 'đúng biên thì vẫn hợp lệ');
  assert.equal(cleanStop({ lat: 0, lng: 0 }).lat, 0, 'số 0 do người dùng thật sự nhập thì giữ');
});

test('a coordinate arriving as a string is accepted', () => {
  // geocoding APIs commonly answer with strings
  const s = cleanStop({ lat: '16.0611', lng: '108.2467' });
  assert.equal(s.lat, 16.0611);
  assert.equal(s.lng, 108.2467);
});
