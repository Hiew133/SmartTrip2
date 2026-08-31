import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dayLabel, daysUntil, first, fmt, formatRange, hasCoords, parseISO,
  stopCount, tripStatus, tripTotal,
} from '../../src/data.js';

const trip = (over = {}) => ({ days: [], expenses: [], startDate: null, endDate: null, ...over });
const day = (...items) => ({ id: 'd', place: '', items });
const stop = (over = {}) => ({ id: 's', time: '09:00', name: 'x', note: '', cost: 0, lat: null, lng: null, ...over });

const isoOffset = (days) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('parseISO accepts only a full ISO date', () => {
  assert.ok(parseISO('2026-09-12') instanceof Date);
  assert.equal(parseISO('12/09/2026'), null);
  assert.equal(parseISO('2026-13-45'), null, 'ngày không tồn tại');
  assert.equal(parseISO(null), null);
  assert.equal(parseISO(20260912), null);
});

test('formatRange collapses what the two dates share', () => {
  assert.equal(formatRange('2026-09-12', '2026-09-15'), '12 – 15/09/2026');
  assert.equal(formatRange('2026-09-28', '2026-10-02'), '28/09 – 02/10/2026');
  assert.equal(formatRange('2026-12-30', '2027-01-02'), '30/12/2026 – 02/01/2027');
  assert.equal(formatRange('2026-09-12', '2026-09-12'), '12/09/2026');
  assert.equal(formatRange('2026-09-12', null), '12/09/2026', 'thiếu ngày về thì coi như đi trong ngày');
  assert.equal(formatRange(null, null), 'Chưa chọn ngày');
});

test('dayLabel counts forward from the start date and rolls over the month', () => {
  assert.equal(dayLabel('2026-09-12', 0), 'Thứ Bảy 12/09');
  assert.equal(dayLabel('2026-09-12', 3), 'Thứ Ba 15/09');
  assert.equal(dayLabel('2026-09-29', 3), 'Thứ Sáu 02/10');
  assert.equal(dayLabel(null, 2), 'Ngày 3', 'chưa có ngày đi thì đánh số');
});

test('daysUntil is whole days, and negative once the trip has started', () => {
  assert.equal(daysUntil(isoOffset(0)), 0);
  assert.equal(daysUntil(isoOffset(5)), 5);
  assert.equal(daysUntil(isoOffset(-3)), -3);
  assert.equal(daysUntil(null), null);
});

test('trip status is derived, so it can never go stale', () => {
  assert.equal(tripStatus(trip()), 'draft', 'chưa có điểm dừng nào');
  assert.equal(tripStatus(trip({ days: [day(stop())], startDate: isoOffset(30), endDate: isoOffset(33) })), 'upcoming');
  assert.equal(tripStatus(trip({ days: [day(stop())], startDate: isoOffset(-40), endDate: isoOffset(-37) })), 'past');
  // a trip that started yesterday and ends tomorrow is still on
  assert.equal(tripStatus(trip({ days: [day(stop())], startDate: isoOffset(-1), endDate: isoOffset(1) })), 'upcoming');
  // dates but no stops is still a draft
  assert.equal(tripStatus(trip({ startDate: isoOffset(-40), endDate: isoOffset(-37) })), 'draft');
});

test('a trip ending today has not been travelled yet', () => {
  assert.equal(tripStatus(trip({ days: [day(stop())], startDate: isoOffset(-2), endDate: isoOffset(0) })), 'upcoming');
});

test('counts add up across days', () => {
  const t = trip({
    days: [day(stop(), stop()), day(stop())],
    expenses: [{ amount: 1000 }, { amount: 500 }],
  });
  assert.equal(stopCount(t), 3);
  assert.equal(tripTotal(t), 1500);
  assert.equal(stopCount(trip()), 0);
  assert.equal(tripTotal(trip()), 0);
});

test('hasCoords needs both halves', () => {
  assert.equal(hasCoords(stop({ lat: 16, lng: 108 })), true);
  assert.equal(hasCoords(stop({ lat: 16 })), false);
  assert.equal(hasCoords(stop({ lat: null, lng: null })), false);
  assert.equal(hasCoords(stop({ lat: 0, lng: 0 })), true, '(0,0) là toạ độ hợp lệ nếu thật sự là số');
});

test('money and names render the way a Vietnamese reader expects', () => {
  assert.equal(fmt(1500000), '1.500.000 ₫');
  assert.equal(fmt(0), '0 ₫');
  assert.equal(fmt(1500.6), '1.501 ₫', 'làm tròn, không hiện số lẻ');
  assert.equal(fmt('không phải số'), '0 ₫');
  assert.equal(first('Minh Trần'), 'Minh');
  assert.equal(first('  Lan   Phạm '), 'Lan');
  assert.equal(first(''), '—');
  assert.equal(first(null), '—');
});
