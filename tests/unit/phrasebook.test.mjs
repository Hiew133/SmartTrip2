import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHRASE_MAX, TARGETS, inTarget, isTranslatable, normalize, phraseKey, recall, remember, targetLabel,
} from '../../src/phrasebook.js';

/* The dedupe key is the feature. Too loose and two different sentences share
   one answer; too strict and the same sentence costs a model call every time
   it is asked — and neither failure announces itself. */

const entry = (over = {}) => ({
  source: 'Cảm ơn', text: 'ขอบคุณ', roman: 'khop khun', literal: 'Cảm ơn',
  note: '', target: 'th', createdAt: 1, ...over,
});

test('spacing and case do not make a new question', () => {
  assert.equal(phraseKey('  Cảm   ơn ', 'th'), phraseKey('cảm ơn', 'th'));
  assert.equal(normalize('  hai   khoảng  '), 'hai khoảng');
});

test('the same sentence in two languages is two questions', () => {
  assert.notEqual(phraseKey('Cảm ơn', 'th'), phraseKey('Cảm ơn', 'ja'));
});

test('remembering the same question twice keeps one entry, the newer one', () => {
  const first = remember([], entry());
  const again = remember(first, entry({ text: 'ขอบคุณครับ', createdAt: 2 }));
  assert.equal(again.length, 1);
  assert.equal(again[0].text, 'ขอบคุณครับ');
});

test('the newest answer sits at the front', () => {
  const list = remember(remember([], entry()), entry({ source: 'Xin chào', text: 'สวัสดี' }));
  assert.equal(list[0].source, 'Xin chào');
  assert.equal(list.length, 2);
});

test('the history is capped, so localStorage never fills up quietly', () => {
  let list = [];
  for (let i = 0; i < 60; i++) list = remember(list, entry({ source: `câu ${i}` }), 40);
  assert.equal(list.length, 40);
  assert.equal(list[0].source, 'câu 59', 'cắt phần cũ, giữ phần mới');
});

test('an entry missing either side is not remembered', () => {
  assert.deepEqual(remember([], { source: 'Cảm ơn' }), []);
  assert.deepEqual(remember([], null), []);
  assert.deepEqual(remember('không phải mảng', entry()).length, 1);
});

test('recall finds the answer regardless of how it was typed the second time', () => {
  const list = remember([], entry());
  assert.equal(recall(list, 'CẢM ƠN', 'th').text, 'ขอบคุณ');
  assert.equal(recall(list, 'Cảm ơn', 'ja'), null);
  assert.equal(recall(null, 'Cảm ơn', 'th'), null);
});

test('the phrasebook can be read one language at a time', () => {
  const list = remember(remember([], entry()), entry({ source: 'Xin chào', text: 'こんにちは', target: 'ja' }));
  assert.equal(inTarget(list, 'ja').length, 1);
  assert.equal(inTarget(list, 'th').length, 1);
  assert.equal(inTarget(list, 'ko').length, 0);
  assert.deepEqual(inTarget(null, 'th'), []);
});

test('what is worth sending to the model', () => {
  assert.equal(isTranslatable('Cho tôi một phần không cay'), true);
  assert.equal(isTranslatable('   '), false);
  assert.equal(isTranslatable(null), false);
  assert.equal(isTranslatable('x'.repeat(PHRASE_MAX + 1)), false);
});

test('every offered language has a Vietnamese name to show', () => {
  TARGETS.forEach((t) => {
    assert.ok(t.code && t.label && t.native);
    assert.equal(targetLabel(t.code), t.label);
  });
  assert.equal(targetLabel('xx'), 'xx', 'ngôn ngữ lạ vẫn hiện được mã, không thành undefined');
});
