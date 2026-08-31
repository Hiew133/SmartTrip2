import test from 'node:test';
import assert from 'node:assert/strict';
import {
  asMinutes, byTime, haversineKm, isOutOfOrder, moveItem, optimizeRoute, routeLengthKm,
} from '../../src/itinerary.js';

const stop = (name, over = {}) => ({ id: name, time: '09:00', name, note: '', cost: 0, lat: null, lng: null, ...over });
const at = (name, lat, lng) => stop(name, { lat, lng });

const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: ${actual} ≉ ${expected}`);

/* ── distance ───────────────────────────────────────────────────────────── */

test('haversine matches known ground distances', () => {
  close(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 111.19, 0.5, 'một độ vĩ');
  close(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 111.32, 0.5, 'một độ kinh ở xích đạo');
  // Đà Nẵng → Hội An, about 24 km apart
  close(haversineKm({ lat: 16.0544, lng: 108.2022 }, { lat: 15.8801, lng: 108.3380 }), 24, 1.5, 'Đà Nẵng–Hội An');
  assert.equal(haversineKm({ lat: 16, lng: 108 }, { lat: 16, lng: 108 }), 0);
});

test('a degree of longitude shrinks with latitude', () => {
  const equator = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
  const north = haversineKm({ lat: 60, lng: 0 }, { lat: 60, lng: 1 });
  close(north / equator, 0.5, 0.01, 'ở 60°N một độ kinh chỉ còn nửa');
});

test('route length only counts stops that have coordinates', () => {
  const items = [at('a', 0, 0), stop('chưa có toạ độ'), at('b', 1, 0)];
  close(routeLengthKm(items), 111.19, 0.5, 'điểm không toạ độ bị bỏ qua, không làm hỏng tổng');
  assert.equal(routeLengthKm([at('a', 0, 0)]), 0);
  assert.equal(routeLengthKm([]), 0);
});

/* ── ordering ───────────────────────────────────────────────────────────── */

test('optimiseRoute keeps the first stop and visits the nearest next', () => {
  const items = [at('start', 16.05, 108.22), at('far', 16.30, 108.22), at('near', 16.08, 108.22)];
  const out = optimizeRoute(items).map((s) => s.name);
  assert.deepEqual(out, ['start', 'near', 'far']);
});

test('optimiseRoute uses ground distance, not degrees', () => {
  /* At 60°N a degree of longitude is half a degree of latitude on the ground.
     Comparing raw degrees — what this used to do — would call `north` (0.5°)
     closer than `east` (0.8°) when east is in fact 11 km nearer. */
  const items = [at('start', 60, 0), at('north', 60.5, 0), at('east', 60, 0.8)];
  assert.deepEqual(optimizeRoute(items).map((s) => s.name), ['start', 'east', 'north']);
});

test('optimiseRoute leaves stops without coordinates at the end, in order', () => {
  const items = [at('start', 16.05, 108.22), stop('x'), at('far', 16.3, 108.22), stop('y'), at('near', 16.08, 108.22)];
  assert.deepEqual(optimizeRoute(items).map((s) => s.name), ['start', 'near', 'far', 'x', 'y']);
});

test('optimiseRoute leaves a day it cannot improve exactly as it was', () => {
  const two = [at('a', 16, 108), at('b', 17, 108)];
  assert.equal(optimizeRoute(two), two, 'dưới 3 điểm có toạ độ thì trả về chính mảng cũ');
  const none = [stop('a'), stop('b'), stop('c')];
  assert.equal(optimizeRoute(none), none);
});

test('each stop keeps its own time through a reorder', () => {
  const items = [
    at('start', 16.05, 108.22),
    { ...at('far', 16.30, 108.22), time: '10:00' },
    { ...at('near', 16.08, 108.22), time: '18:30' },
  ];
  const out = optimizeRoute(items);
  assert.equal(out.find((s) => s.name === 'near').time, '18:30');
  assert.equal(out.find((s) => s.name === 'far').time, '10:00');
});

/* ── clock ──────────────────────────────────────────────────────────────── */

test('asMinutes reads a clock and rejects everything else', () => {
  assert.equal(asMinutes(stop('a', { time: '00:00' })), 0);
  assert.equal(asMinutes(stop('a', { time: '9:05' })), 545);
  assert.equal(asMinutes(stop('a', { time: '23:59' })), 1439);
  assert.equal(asMinutes(stop('a', { time: '--:--' })), null);
  assert.equal(asMinutes(stop('a', { time: '' })), null);
  assert.equal(asMinutes(stop('a', { time: '25:00' })), null, 'giờ không tồn tại');
  assert.equal(asMinutes(stop('a', { time: '10:75' })), null, 'phút không tồn tại');
});

test('isOutOfOrder ignores stops with no time', () => {
  assert.equal(isOutOfOrder([stop('a', { time: '08:00' }), stop('b', { time: '12:00' })]), false);
  assert.equal(isOutOfOrder([stop('a', { time: '12:00' }), stop('b', { time: '08:00' })]), true);
  assert.equal(isOutOfOrder([stop('a', { time: '12:00' }), stop('b', { time: '--:--' })]), false);
  assert.equal(isOutOfOrder([]), false);
});

test('byTime sorts by clock and sinks untimed stops, keeping their order', () => {
  const items = [
    stop('trưa', { time: '12:00' }),
    stop('chưa đặt giờ', { time: '--:--' }),
    stop('sáng', { time: '08:00' }),
    stop('cũng chưa', { time: '--:--' }),
  ];
  assert.deepEqual(byTime(items).map((s) => s.name), ['sáng', 'trưa', 'chưa đặt giờ', 'cũng chưa']);
});

/* ── moving rows ────────────────────────────────────────────────────────── */

test('moveItem moves one row and leaves the rest in order', () => {
  const l = ['a', 'b', 'c', 'd'];
  assert.deepEqual(moveItem(l, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveItem(l, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(moveItem(l, 1, 2), ['a', 'c', 'b', 'd']);
});

test('moveItem returns the same list when the move is a no-op or out of range', () => {
  const l = ['a', 'b', 'c'];
  assert.equal(moveItem(l, 1, 1), l);
  assert.equal(moveItem(l, -1, 0), l);
  assert.equal(moveItem(l, 5, 0), l);
  assert.equal(moveItem(l, 0, -1), l, 'kéo lên khỏi đầu danh sách');
  assert.equal(moveItem(l, 2, 9), l, 'kéo xuống khỏi cuối danh sách');
  assert.deepEqual(l, ['a', 'b', 'c'], 'không sửa mảng gốc');
});
