import { useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import {
  LANGS, PHRASE_MAX, inPair, isTranslatable, langLabel, normalize, recall, speechTag, usesLatin,
} from '../phrasebook.js';
import {
  aiAvailable, forgetPhrases, readPhrases, savePhrase, translateText,
} from '../backend/index.js';
import { ArrowRight, Check, En, Mic, Speaker, Swap } from '../components/ui.jsx';
import { useDictation, useSpeaking } from '../components/useSpeech.js';

/* Two panes and a swap between them, because a conversation has two sides.
 *
 * This screen used to translate one way — Vietnamese out into any of eight
 * languages — which is a phrasebook. The moment the other person answers, a
 * phrasebook has nothing to offer. Three languages in either direction is the
 * smaller, more useful shape: you say something, they say something back, and
 * both halves land on the same screen.
 *
 * Everything here is device-local. The phrases are cached in the browser, not
 * in a trip, because they belong to whoever is standing there asking — and
 * that is also what makes the screen work with no signal, which is exactly
 * when somebody needs it most.
 */

function LangPicker({ value, onPick, exclude, label }) {
  return (
    <div className="st-tr-langs" role="group" aria-label={label}>
      {LANGS.map((l) => (
        <button key={l.code} type="button"
          className={`st-tr-lang ${l.code === value ? 'active' : ''}`}
          aria-pressed={l.code === value}
          disabled={l.code === exclude}
          title={l.code === exclude ? 'Đang là ngôn ngữ bên kia' : undefined}
          onClick={() => onPick(l.code)}>
          {l.native}
        </button>
      ))}
    </div>
  );
}

export default function Translate() {
  const { notify } = useApp();
  const [from, setFrom] = useState('vi');
  const [target, setTarget] = useState('en');
  const [text, setText] = useState('');
  const [history, setHistory] = useState(() => readPhrases());
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const outRef = useRef(null);

  const voice = useSpeaking();
  /* Dictation writes straight into the box and then translates, so the whole
     spoken-to-spoken path is one press of the microphone. */
  const ear = useDictation({
    tag: speechTag(from),
    onFinal: (said) => { setText(said); run(said); },
  });

  const recent = inPair(history, from, target).slice(0, 8);
  const cached = recall(history, text, from, target);

  const swap = () => {
    /* Swapping carries the answer back into the box: they said something, you
       read it, and now you want to reply to exactly that. */
    setFrom(target);
    setTarget(from);
    setText(result ? result.text : '');
    setResult(null);
    setError('');
  };

  const pick = (side) => (code) => {
    if (side === 'from') {
      setFrom(code);
      if (code === target) setTarget(from);     // never let both sides agree
    } else {
      setTarget(code);
      if (code === from) setFrom(target);
    }
    setResult(null);
    setError('');
  };

  const run = async (raw = text) => {
    const source = normalize(raw);
    if (!isTranslatable(source)) {
      setError(source
        ? `Câu này dài quá — cắt xuống dưới ${PHRASE_MAX} ký tự rồi dịch từng đoạn.`
        : 'Gõ hoặc nói câu bạn muốn dịch đã.');
      return;
    }

    /* A sentence already asked about is answered from the phrasebook rather
       than the model: same answer, costs nothing, and it is the only one
       available with no network. */
    const known = recall(history, source, from, target);
    if (known) {
      setResult(known);
      setError('');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const out = await translateText({
        text: source,
        from,
        fromName: langLabel(from),
        target,
        targetName: langLabel(target),
      });
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

  const reuse = (e) => {
    setFrom(e.from);
    setTarget(e.target);
    setText(e.source);
    setResult(e);
    setError('');
  };

  const shown = ear.listening && ear.heard ? ear.heard : text;

  return (
    <div className="st-page st-page-narrow">
      <header className="st-rise">
        <span className="st-eyebrow">Sổ tay dịch<En>&nbsp;· Phrasebook</En></span>
        <h1 className="st-display">Nói được câu cần nói</h1>
        <p className="st-lede" style={{ margin: '14px 0 0' }}>
          Việt · Anh · Nhật, dịch được cả hai chiều. Bấm micro để nói, bấm loa để máy đọc
          câu đó lên. Câu nào đã dịch một lần thì nằm lại trong máy — mất mạng vẫn mở được.
        </p>
        {!aiAvailable && (
          <p className="st-hint" style={{ marginTop: 18, display: 'inline-flex' }}>
            Chưa nối Firebase AI Logic — chế độ thử chưa dịch thật. Xem README để bật Gemini.
          </p>
        )}
      </header>

      <div className="st-tr st-rise">
        {/* — what you say — */}
        <section className="st-tr-pane">
          <div className="st-tr-head">
            <LangPicker value={from} onPick={pick('from')} exclude={target} label="Ngôn ngữ nguồn" />
          </div>
          <textarea className="input st-tr-text" id="tr-text" rows={4} value={shown}
            maxLength={PHRASE_MAX} lang={from}
            aria-label={`Câu tiếng ${langLabel(from).replace('Tiếng ', '')}`}
            placeholder={ear.listening ? 'Đang nghe…' : 'vd: Cho tôi một phần không cay, không hành.'}
            onChange={(e) => { setText(e.target.value); setError(''); }}
            /* Enter sends, Shift+Enter is a new line — the phone keyboard case */
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); }
            }} />
          <div className="st-tr-foot">
            {ear.supported && (
              <button type="button"
                className={`st-tr-mic ${ear.listening ? 'live' : ''}`}
                aria-pressed={ear.listening}
                aria-label={ear.listening ? 'Dừng nghe' : `Nói bằng ${langLabel(from)}`}
                onClick={() => (ear.listening ? ear.stop() : ear.start())}>
                <Mic width="17" height="17" />
                {ear.listening ? 'Đang nghe…' : 'Nói'}
              </button>
            )}
            {voice.supported && shown.trim() && !ear.listening && (
              <button type="button" className="st-tr-icon" aria-label="Đọc câu của bạn"
                onClick={() => voice.speak(shown, speechTag(from))}>
                <Speaker width="16" height="16" />
              </button>
            )}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-primary" style={{ fontSize: 13 }}
              onClick={() => run()} disabled={busy || ear.listening}>
              {busy ? 'Đang dịch…' : <>Dịch<ArrowRight width="14" height="14" /></>}
            </button>
          </div>
        </section>

        <button type="button" className="st-tr-swap" onClick={swap}
          aria-label={`Đổi chiều: ${langLabel(target)} sang ${langLabel(from)}`}>
          <Swap width="18" height="18" />
        </button>

        {/* — what they read — */}
        <section className="st-tr-pane out" ref={outRef} tabIndex={-1}>
          <div className="st-tr-head">
            <LangPicker value={target} onPick={pick('target')} exclude={from} label="Ngôn ngữ đích" />
          </div>

          {result ? (
            <>
              {/* the line a stranger reads off the screen, so it is the biggest thing here */}
              <p className="st-translate-text" lang={result.target}>{result.text}</p>
              {result.roman && !usesLatin(result.target) && (
                <p className="st-translate-roman">Đọc là: {result.roman}</p>
              )}
              {result.literal && (
                <p className="st-translate-back">
                  <b>Nghĩa đen:</b> {result.literal}
                  <En> · what it literally says back</En>
                </p>
              )}
              {result.note && <p className="st-translate-note">{result.note}</p>}
            </>
          ) : (
            <p className="st-tr-empty">
              {busy ? 'Đang dịch…' : 'Bản dịch sẽ hiện ở đây, đủ to để đưa màn hình cho người đối diện đọc.'}
            </p>
          )}

          <div className="st-tr-foot">
            {voice.supported && result && (
              <button type="button" className={`st-tr-mic ${voice.speaking ? 'live' : ''}`}
                aria-label={`Đọc bản dịch bằng ${langLabel(target)}`}
                onClick={() => (voice.speaking ? voice.hush() : voice.speak(result.text, speechTag(target)))}>
                <Speaker width="17" height="17" />
                {voice.speaking ? 'Đang đọc…' : 'Nghe'}
              </button>
            )}
            <span style={{ flex: 1 }} />
            {result && (
              <button type="button" className="btn btn-secondary" style={{ fontSize: 13 }} onClick={copy}>
                <Check width="14" height="14" />Sao chép
              </button>
            )}
          </div>
        </section>
      </div>

      {(error || ear.error) && <p className="st-error" style={{ marginTop: 14 }}>{error || ear.error}</p>}
      {cached && !busy && !result && (
        <p className="text-muted" style={{ fontSize: 13, marginTop: 12 }}>
          Câu này đã dịch rồi — mở lại không tốn thêm lượt gọi AI.
        </p>
      )}
      {!ear.supported && (
        <p className="st-fineprint">
          Trình duyệt này không nhận dạng được giọng nói, nên chỉ có phần gõ chữ. Chrome,
          Edge và Safari thì có; Firefox thì chưa.
        </p>
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
            Cả hai chiều của cặp ngôn ngữ đang chọn, nằm trong trình duyệt này.
          </p>
          <div className="st-phrases">
            {recent.map((e) => (
              <button key={`${e.from}-${e.target}-${e.source}`} type="button" className="st-phrase st-phrase-btn"
                onClick={() => reuse(e)}>
                <span className="st-phrase-dir">{langLabel(e.from)} → {langLabel(e.target)}</span>
                <span className="st-phrase-vi">{e.source}</span>
                <span className="st-phrase-local" lang={e.target}>{e.text}</span>
                {e.roman && !usesLatin(e.target) && <span className="st-phrase-roman">đọc: {e.roman}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
