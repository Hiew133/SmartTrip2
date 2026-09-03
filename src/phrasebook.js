/* The phrasebook: what this device remembers of everything it has translated.
 *
 * Pure list logic, no storage and no network — backend/offline.js does the
 * localStorage part, backend/ai.js does the asking. Kept here because the
 * dedupe key is the whole feature: get it wrong and either the same sentence
 * costs a model call every time it is asked for, or two different sentences
 * share one answer. Both are quiet failures, so both get a test.
 *
 * The cache is also the offline story. Somebody standing in a market with no
 * signal has exactly the phrases they looked up before they left, which is why
 * entries are kept newest-first and trimmed rather than expired by age: an old
 * translation of "cho tôi xin hoá đơn" is not stale, it is the same sentence.
 */

/** Languages offered by default. `code` is what the model is told to answer in. */
export const TARGETS = [
  { code: 'th', label: 'Tiếng Thái', native: 'ภาษาไทย' },
  { code: 'ja', label: 'Tiếng Nhật', native: '日本語' },
  { code: 'ko', label: 'Tiếng Hàn', native: '한국어' },
  { code: 'zh', label: 'Tiếng Trung', native: '中文' },
  { code: 'en', label: 'Tiếng Anh', native: 'English' },
  { code: 'km', label: 'Tiếng Khmer', native: 'ភាសាខ្មែរ' },
  { code: 'lo', label: 'Tiếng Lào', native: 'ພາສາລາວ' },
  { code: 'vi', label: 'Tiếng Việt', native: 'Tiếng Việt' },
];

export const targetLabel = (code) => TARGETS.find((t) => t.code === code)?.label ?? code;

/** Collapse a sentence to the form two people would call "the same question". */
export const normalize = (text) => String(text ?? '').trim().replace(/\s+/g, ' ');

/**
 * Cache key for one lookup. Case and spacing do not change what a sentence
 * means, so they do not get their own cache entry — but the direction does:
 * "Cảm ơn" into Thai and into Japanese are two different answers.
 */
export const phraseKey = (source, target) =>
  `${String(target ?? '')}::${normalize(source).toLowerCase()}`;

/** Longest sentence worth sending; past this it is a document, not a phrase. */
export const PHRASE_MAX = 400;

/** True when there is something to translate and it is not a whole essay. */
export const isTranslatable = (text) => {
  const t = normalize(text);
  return t.length > 0 && t.length <= PHRASE_MAX;
};

/**
 * Put an entry at the front of the history, dropping any older answer for the
 * same key. Newest-first with a hard cap: the list is a convenience, and an
 * unbounded one would quietly grow until localStorage refused the write.
 */
export function remember(list, entry, max = 40) {
  if (!entry?.source || !entry?.text) return Array.isArray(list) ? list : [];
  const key = phraseKey(entry.source, entry.target);
  const rest = (Array.isArray(list) ? list : [])
    .filter((e) => e && phraseKey(e.source, e.target) !== key);
  return [entry, ...rest].slice(0, max);
}

/** The remembered answer for this exact question, or null. */
export function recall(list, source, target) {
  if (!Array.isArray(list)) return null;
  const key = phraseKey(source, target);
  return list.find((e) => e && phraseKey(e.source, e.target) === key) ?? null;
}

/** Everything remembered in one language, newest first. */
export const inTarget = (list, target) =>
  (Array.isArray(list) ? list : []).filter((e) => e && e.target === target);
