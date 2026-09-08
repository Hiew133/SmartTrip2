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

/* Three languages, translated in either direction.
 *
 * It used to be one direction — Vietnamese out to any of eight — which is the
 * shape of a phrasebook, not of a conversation. The person opposite says
 * something back, and eight one-way languages had no way to carry it.
 *
 * Three rather than eight because a language is not just a chip in a list:
 * each one needs a voice the browser can actually speak and recognise, and a
 * `roman` reading that means something. Adding a fourth is adding a row here
 * and checking the speech tag exists — deliberately small, deliberately not
 * a long menu of things that half work.
 *
 * `speech` is the BCP-47 tag the Web Speech API wants; `latin` says whether a
 * pronunciation line would just repeat the translation.
 */
export const LANGS = [
  { code: 'vi', label: 'Tiếng Việt', native: 'Tiếng Việt', speech: 'vi-VN', latin: true },
  { code: 'en', label: 'Tiếng Anh', native: 'English', speech: 'en-US', latin: true },
  { code: 'ja', label: 'Tiếng Nhật', native: '日本語', speech: 'ja-JP', latin: false },
];

export const lang = (code) => LANGS.find((l) => l.code === code) ?? null;
export const langLabel = (code) => lang(code)?.label ?? code;
export const speechTag = (code) => lang(code)?.speech ?? code;
export const usesLatin = (code) => lang(code)?.latin === true;

/** The other two languages — what a swap or a source picker may offer. */
export const otherLangs = (code) => LANGS.filter((l) => l.code !== code);

/** Collapse a sentence to the form two people would call "the same question". */
export const normalize = (text) => String(text ?? '').trim().replace(/\s+/g, ' ');

/**
 * Cache key for one lookup. Case and spacing do not change what a sentence
 * means, so they do not get their own cache entry — but the direction does,
 * and now that means *both* ends of it.
 *
 * The `from` half is not decoration. "No" from English into Vietnamese and
 * "no" from Japanese into Vietnamese are different questions with different
 * answers, and a key built only from the target would have served one of them
 * the other's translation.
 */
export const phraseKey = (source, from, target) =>
  `${String(from ?? '')}>${String(target ?? '')}::${normalize(source).toLowerCase()}`;

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
  const key = phraseKey(entry.source, entry.from, entry.target);
  const rest = (Array.isArray(list) ? list : [])
    .filter((e) => e && phraseKey(e.source, e.from, e.target) !== key);
  return [entry, ...rest].slice(0, max);
}

/** The remembered answer for this exact question, or null. */
export function recall(list, source, from, target) {
  if (!Array.isArray(list)) return null;
  const key = phraseKey(source, from, target);
  return list.find((e) => e && phraseKey(e.source, e.from, e.target) === key) ?? null;
}

/**
 * Everything remembered for one pair of languages, newest first — and for the
 * reverse pair too, because a conversation runs both ways and what the other
 * person said a minute ago is exactly what you want back on screen.
 */
export const inPair = (list, from, target) => (Array.isArray(list) ? list : [])
  .filter((e) => e && ((e.from === from && e.target === target) || (e.from === target && e.target === from)));
