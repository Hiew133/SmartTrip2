import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGS, PHRASE_MAX, inPair, isTranslatable, langLabel, normalize, otherLangs,
  phraseKey, recall, remember, speechTag, usesLatin,
} from '../../src/phrasebook.js';

/* The dedupe key is the feature. Too loose and two different sentences share
   one answer; too strict and the same sentence costs a model call every time
   it is asked — and neither failure announces itself. */

const entry = (over = {}) => ({
  source: 'Cảm ơn', text: 'Thank you', roman: '', literal: 'Cảm ơn',
  note: '', from: 'vi', target: 'en', createdAt: 1, ...over,
});

test('spacing and case do not make a new question', () => {
  assert.equal(phraseKey('  Cảm   ơn ', 'vi', 'en'), phraseKey('cảm ơn', 'vi', 'en'));
  assert.equal(normalize('  hai   khoảng  '), 'hai khoảng');
});

test('the same sentence into two languages is two questions', () => {
  assert.notEqual(phraseKey('Cảm ơn', 'vi', 'en'), phraseKey('Cảm ơn', 'vi', 'ja'));
});

test('direction is part of the question, not just the destination', () => {
  // the reason `from` is in the key at all: same text, same target, other source
  assert.notEqual(phraseKey('no', 'en', 'vi'), phraseKey('no', 'ja', 'vi'));
  // and the reverse of a pair is its own question
  assert.notEqual(phraseKey('Cảm ơn', 'vi', 'en'), phraseKey('Cảm ơn', 'en', 'vi'));
});

test('remembering the same question twice keeps one entry, the newer one', () => {
  const first = remember([], entry());
  const again = remember(first, entry({ text: 'Thanks a lot', createdAt: 2 }));
  assert.equal(again.length, 1);
  assert.equal(again[0].text, 'Thanks a lot');
});

test('the same sentence in the other direction is kept separately', () => {
  const list = remember(remember([], entry()), entry({ from: 'en', target: 'vi', text: 'Cảm ơn' }));
  assert.equal(list.length, 2);
});

test('the newest answer sits at the front', () => {
  const list = remember(remember([], entry()), entry({ source: 'Xin chào', text: 'Hello' }));
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
  assert.equal(recall(list, 'CẢM ƠN', 'vi', 'en').text, 'Thank you');
  assert.equal(recall(list, 'Cảm ơn', 'vi', 'ja'), null);
  assert.equal(recall(list, 'Cảm ơn', 'en', 'vi'), null, 'chiều ngược lại là câu hỏi khác');
  assert.equal(recall(null, 'Cảm ơn', 'vi', 'en'), null);
});

/* ── reading the book back ──────────────────────────────────────────────── */

test('a pair shows both of its directions, because a conversation has two', () => {
  const list = [
    entry({ source: 'Cảm ơn', from: 'vi', target: 'en' }),
    entry({ source: 'You are welcome', from: 'en', target: 'vi', text: 'Không có gì' }),
    entry({ source: 'Xin chào', from: 'vi', target: 'ja', text: 'こんにちは' }),
  ].reduce((acc, e) => remember(acc, e), []);

  assert.equal(inPair(list, 'vi', 'en').length, 2, 'cả hai chiều Việt–Anh');
  assert.equal(inPair(list, 'en', 'vi').length, 2, 'hỏi ngược lại vẫn ra đúng cặp đó');
  assert.equal(inPair(list, 'vi', 'ja').length, 1);
  assert.equal(inPair(list, 'en', 'ja').length, 0);
  assert.deepEqual(inPair(null, 'vi', 'en'), []);
});

test('what is worth sending to the model', () => {
  assert.equal(isTranslatable('Cho tôi một phần không cay'), true);
  assert.equal(isTranslatable('   '), false);
  assert.equal(isTranslatable(null), false);
  assert.equal(isTranslatable('x'.repeat(PHRASE_MAX + 1)), false);
});

/* ── the three languages ────────────────────────────────────────────────── */

test('every language can be named, spoken and listened for', () => {
  assert.equal(LANGS.length, 3);
  LANGS.forEach((l) => {
    assert.ok(l.code && l.label && l.native);
    assert.equal(langLabel(l.code), l.label);
    // a speech tag the Web Speech API will accept, not a bare language code
    assert.match(speechTag(l.code), /^[a-z]{2}-[A-Z]{2}$/);
    assert.equal(typeof l.latin, 'boolean');
  });
});

test('a pronunciation line is only offered where it would say something new', () => {
  assert.equal(usesLatin('vi'), true);
  assert.equal(usesLatin('en'), true);
  assert.equal(usesLatin('ja'), false, 'chỉ tiếng Nhật mới cần dòng cách đọc');
  assert.equal(usesLatin('xx'), false);
});

test('an unknown language degrades to its code rather than to undefined', () => {
  assert.equal(langLabel('xx'), 'xx');
  assert.equal(speechTag('xx'), 'xx');
});

test('swapping always has somewhere to go', () => {
  LANGS.forEach((l) => {
    const rest = otherLangs(l.code);
    assert.equal(rest.length, 2);
    assert.ok(!rest.some((r) => r.code === l.code));
  });
});
