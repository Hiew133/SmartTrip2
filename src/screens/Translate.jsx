import { useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import {
  PHRASE_MAX, TARGETS, inTarget, isTranslatable, normalize, recall, targetLabel,
} from '../phrasebook.js';
import {
  aiAvailable, forgetPhrases, readPhrases, savePhrase, translateText,
} from '../backend/index.js';
import { ArrowRight, Check, En } from '../components/ui.jsx';

/* Everything this screen shows is device-local: the phrases are cached in the
   browser, not in a trip, because they belong to whoever is standing there
   asking — not to the group. That also makes the whole screen work with no
   signal, which is when a person is most likely to need it. */

export default function Translate() {
  const { notify } = useApp();
  const [target, setTarget] = useState(TARGETS[0].code);
  const [text, setText] = useState('');
  const [history, setHistory] = useState(() => readPhrases());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const outRef = useRef(null);

  const recent = inTarget(history, target).slice(0, 8);
  const cached = recall(history, text, target);

  const run = async () => {
    const source = normalize(text);
    if (!isTranslatable(source)) {
      setError(source
        ? `Câu này dài quá — cắt xuống dưới ${PHRASE_MAX} ký tự rồi dịch từng đoạn.`
        : 'Gõ câu bạn muốn nói đã.');
      return;
    }

    /* A sentence already asked about is answered from the phonebook rather
       than the model: it is the same answer, it costs nothing, and it is the
       only one available when there is no network. */
    const known = recall(history, source, target);
    if (known) {
      setResult(known);
      setError('');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const out = await translateText({ text: source, target, targetName: targetLabel(target) });
      setHistory(savePhrase(out));
      setResult(out);
    } catch (err) {
      console.error('SmartTrip · dịch:', err);
      setError(err?.message || 'Không dịch được câu này. Thử lại giúp mình.');
    } finally {
      setBusy(false);
    }
  };

  /* writeText returns a promise, so a blocked clipboard has to be caught in
     the rejection — the same trap the invite link fell into. */
  const copy = () => {
    const fail = () => {
      setError('Trình duyệt không cho sao chép tự động — bôi đen dòng chữ rồi bấm Ctrl+C.');
      outRef.current?.focus();
    };
    try {
      const p = navigator.clipboard?.writeText(result.text);
      if (p && typeof p.then === 'function') p.then(() => notify('Đã sao chép bản dịch', 'sage'), fail);
      else fail();
    } catch {
      fail();
    }
  };

  const reuse = (entry) => {
    setText(entry.source);
    setResult(entry);
    setError('');
  };

  return (
    <div className="st-page st-page-narrow">
      <header className="st-rise">
        <span className="st-eyebrow">Sổ tay dịch<En>&nbsp;· Phrasebook</En></span>
        <h1 className="st-display">Nói được câu cần nói</h1>
        <p className="st-lede" style={{ margin: '14px 0 0' }}>
          Gõ câu tiếng Việt, đưa màn hình cho người đối diện đọc. Câu nào đã dịch một lần
          thì nằm lại trong máy — mất mạng vẫn mở ra được.
        </p>
        {!aiAvailable && (
          <p className="st-hint" style={{ marginTop: 18, display: 'inline-flex' }}>
            Chưa nối Firebase AI Logic — chế độ thử chưa dịch thật. Xem README để bật Gemini.
          </p>
        )}
      </header>

      <div className="st-rise" style={{ marginTop: 30 }}>
        <div className="field">
          <label>Dịch sang<En> · Translate into</En></label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TARGETS.map((t) => (
              <button key={t.code} type="button" className={`st-chip ${t.code === target ? 'active' : ''}`}
                aria-pressed={t.code === target}
                onClick={() => { setTarget(t.code); setResult(null); setError(''); }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field" style={{ marginTop: 18 }}>
          <label htmlFor="tr-text">Câu của bạn</label>
          <textarea className="input st-translate-in" id="tr-text" rows={3} value={text}
            maxLength={PHRASE_MAX} placeholder="vd: Cho tôi một phần không cay, không hành."
            onChange={(e) => { setText(e.target.value); setError(''); }}
            /* Enter sends, Shift+Enter is a new line — the phone keyboard case */
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); }
            }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? 'Đang dịch…' : <>Dịch<ArrowRight width="15" height="15" /></>}
          </button>
          {cached && !busy && (
            <span className="text-muted" style={{ fontSize: 13 }}>
              Câu này đã dịch rồi — mở lại không tốn thêm lượt gọi AI.
            </span>
          )}
        </div>

        {error && <p className="st-error" style={{ marginTop: 16 }}>{error}</p>}
      </div>

      {result && (
        <div className="st-translate-out st-rise" ref={outRef} tabIndex={-1}>
          <span className="st-translate-label">{targetLabel(result.target)}</span>
          {/* the line a stranger reads off the screen, so it is the biggest thing here */}
          <p className="st-translate-text" lang={result.target || undefined}>{result.text}</p>
          {result.roman && <p className="st-translate-roman">Đọc là: {result.roman}</p>}
          {result.literal && (
            <p className="st-translate-back">
              <b>Nghĩa đen:</b> {result.literal}
              <En> · what it literally says back in Vietnamese</En>
            </p>
          )}
          {result.note && <p className="st-translate-note">{result.note}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={copy}>
              <Check width="14" height="14" />Sao chép
            </button>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <section style={{ marginTop: 34 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 19 }}>
              Đã dịch<En> · Saved on this device</En>
            </h3>
            <span style={{ flex: 1 }} />
            <button type="button" className="st-linkbtn"
              onClick={() => { setHistory(forgetPhrases()); notify('Đã xoá sổ tay trên máy này', 'neutral'); }}>
              Xoá hết
            </button>
          </div>
          <p className="text-muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
            Nằm trong trình duyệt này, mở được khi không có mạng.
          </p>
          <div className="st-phrases">
            {recent.map((e) => (
              <button key={`${e.target}-${e.source}`} type="button" className="st-phrase st-phrase-btn"
                onClick={() => reuse(e)}>
                <span className="st-phrase-vi">{e.source}</span>
                <span className="st-phrase-local">{e.text}</span>
                {e.roman && <span className="st-phrase-roman">đọc: {e.roman}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
