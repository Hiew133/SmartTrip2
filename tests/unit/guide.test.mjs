import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationsOf, isGuideEmpty, slugFor } from '../../src/guide.js';
import { cleanGuide, cleanTranslation } from '../../src/backend/schema.js';

/* The slug becomes a Firestore document id, so a wrong answer here does not
   throw — it quietly writes a second guidebook for a place that already has
   one, and the person pays for the model call twice. */

test('a slug is ASCII, lowercase and free of punctuation', () => {
  assert.equal(slugFor('Hội An'), 'hoi-an');
  assert.equal(slugFor('Bangkok, Thái Lan'), 'bangkok-thai-lan');
  assert.equal(slugFor('  Đà Nẵng  '), 'da-nang');
  assert.equal(slugFor('Đà Nẵng – Hội An'), 'da-nang-hoi-an');
});

test('the same place written two ways gets one guidebook', () => {
  assert.equal(slugFor('Hội An'), slugFor('Hoi An'));
  assert.equal(slugFor('ĐÀ NẴNG'), slugFor('đà nẵng'));
});

test('a slug is never empty — Firestore would refuse the write', () => {
  ['', '   ', null, undefined, '···'].forEach((junk) => {
    assert.equal(slugFor(junk), 'noi-den');
  });
  // a name that survives as anything at all keeps what survived
  assert.equal(slugFor(42), '42');
});

test('a very long name is cut without leaving a trailing dash', () => {
  const slug = slugFor(`${'Thành phố '.repeat(20)}xa`);
  assert.ok(slug.length <= 60);
  assert.ok(!slug.endsWith('-'), 'dấu gạch cuối là một ký tự vô nghĩa trong id');
});

test('destinations come from the title and the days, without repeats', () => {
  const trip = {
    title: 'Đà Nẵng – Hội An',
    days: [{ place: 'Đà Nẵng' }, { place: 'Bà Nà Hills' }, { place: 'Hội An' }, { place: '' }],
  };
  assert.deepEqual(destinationsOf(trip), ['Đà Nẵng', 'Hội An', 'Bà Nà Hills']);
});

test('a trip with nothing in it offers nothing rather than throwing', () => {
  assert.deepEqual(destinationsOf({}), []);
  assert.deepEqual(destinationsOf(null), []);
  assert.deepEqual(destinationsOf({ title: 'Chuyến đi mới', days: [] }), ['Chuyến đi mới']);
});

test('a bare hyphen inside a name is not a separator', () => {
  // "Buôn Ma Thuột" style names survive; only a spaced hyphen splits
  assert.deepEqual(destinationsOf({ title: 'Ba Vì - Hà Nội', days: [] }), ['Ba Vì', 'Hà Nội']);
  assert.deepEqual(destinationsOf({ title: 'Sài Gòn-Vũng Tàu', days: [] }), ['Sài Gòn-Vũng Tàu']);
});

/* ── the guidebook itself ─────────────────────────────────────────────────
   Security Rules can count rows but cannot read them, so every length cap
   below is the only thing standing between a model answer and a megabyte of
   text in everybody's browser. */

const guide = (over = {}) => ({
  dest: 'Bangkok',
  lang: 'Tiếng Thái',
  currency: 'Baht',
  summary: 'Tóm tắt.',
  sections: [{ title: 'Đi lại', tips: ['BTS chạy tới nửa đêm'] }],
  phrases: [{ vi: 'Cảm ơn', local: 'ขอบคุณ', roman: 'khop khun' }],
  emergency: [{ label: 'Cấp cứu', value: '1669' }],
  createdAt: 5,
  ...over,
});

test('junk in, null out', () => {
  [null, undefined, 7, 'chuỗi', []].forEach((junk) => assert.equal(cleanGuide(junk), null));
});

test('a guidebook with nothing to read is dropped, not shown empty', () => {
  assert.equal(cleanGuide(guide({ sections: [], phrases: [] })), null);
  assert.equal(cleanGuide(guide({ sections: 'không phải mảng', phrases: null })), null);
});

test('rows that cannot be repaired are dropped, the rest survive', () => {
  const g = cleanGuide(guide({
    sections: [{ title: 'Đi lại', tips: ['ok', 42, '', null] }, 'không phải mục', null],
    phrases: [
      { vi: 'Cảm ơn', local: 'ขอบคุณ' },
      { vi: 'Thiếu bản địa' },                 // no local text — nothing to point at
      { local: 'thiếu tiếng Việt' },
    ],
    emergency: [{ label: 'Cấp cứu', value: '1669' }, { label: 'Thiếu số' }],
  }));
  assert.equal(g.sections.length, 1);
  assert.deepEqual(g.sections[0].tips, ['ok']);
  assert.equal(g.phrases.length, 1);
  assert.equal(g.phrases[0].roman, '', 'cách đọc thiếu là chuỗi rỗng, không phải undefined');
  assert.equal(g.emergency.length, 1);
});

test('a guidebook cannot grow past what the rules allow', () => {
  const g = cleanGuide(guide({
    sections: Array.from({ length: 40 }, (_, i) => ({ title: `Mục ${i}`, tips: ['x'] })),
    phrases: Array.from({ length: 200 }, (_, i) => ({ vi: `câu ${i}`, local: `l${i}` })),
    emergency: Array.from({ length: 50 }, (_, i) => ({ label: `n${i}`, value: `${i}` })),
  }));
  assert.equal(g.sections.length, 20);
  assert.equal(g.phrases.length, 60);
  assert.equal(g.emergency.length, 20);
});

test('long text is clipped, because rules count rows and not characters', () => {
  const g = cleanGuide(guide({
    summary: 'x'.repeat(5000),
    sections: [{ title: 'y'.repeat(400), tips: ['z'.repeat(2000)] }],
  }));
  assert.equal(g.summary.length, 2000);
  assert.equal(g.sections[0].title.length, 120);
  assert.equal(g.sections[0].tips[0].length, 400);
});

test('a section with no title still counts if it has tips', () => {
  const g = cleanGuide(guide({ sections: [{ tips: ['một mẹo'] }] }));
  assert.equal(g.sections[0].title, 'Ghi chú');
});

test('isGuideEmpty answers for a missing guidebook too', () => {
  assert.equal(isGuideEmpty(null), true);
  assert.equal(isGuideEmpty({ sections: [], phrases: [] }), true);
  assert.equal(isGuideEmpty(cleanGuide(guide())), false);
});

/* ── one translated line ─────────────────────────────────────────────────── */

test('a translation needs both the question and the answer', () => {
  assert.equal(cleanTranslation({ source: 'Cảm ơn' }), null);
  assert.equal(cleanTranslation({ text: 'ขอบคุณ' }), null);
  assert.equal(cleanTranslation(null), null);

  const ok = cleanTranslation({ source: ' Cảm ơn ', text: 'ขอบคุณ', target: 'th' });
  assert.equal(ok.source, 'Cảm ơn', 'khoảng trắng thừa bị cắt trước khi thành khoá cache');
  assert.equal(ok.roman, '');
  assert.equal(ok.createdAt, 0);
});
