import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../store.jsx';
import { destinationsOf, slugFor } from '../../guide.js';
import { aiAvailable, generateGuide } from '../../backend/index.js';
import { Check, Compass, En } from '../../components/ui.jsx';

/* The guidebook is written once per destination and then read, so the wait has
   the shape of the answer rather than a spinner — same choice as the AI desk. */
function GuideSkeleton() {
  return (
    <div className="st-guide" aria-live="polite" aria-busy="true">
      <span className="st-skel" style={{ display: 'block', width: '54%', height: 15, marginBottom: 22 }} />
      {[0, 1, 2].map((s) => (
        <div key={s} className="st-guide-sec">
          <span className="st-skel" style={{ display: 'block', width: 150, height: 14, marginBottom: 14 }} />
          {[0, 1, 2].map((r) => (
            <span key={r} className="st-skel"
              style={{ display: 'block', width: `${72 - r * 9}%`, height: 11, marginBottom: 10 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function GuideTab({ trip, editable }) {
  const { notify, actions } = useApp();

  /* Where a guidebook could be useful: the places this trip is actually about,
     plus anywhere the person types. The first suggestion is the default so the
     common case is one button press. */
  const suggestions = useMemo(() => destinationsOf(trip), [trip]);
  const [dest, setDest] = useState(suggestions[0] ?? trip.title ?? '');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDrop, setConfirmDrop] = useState(false);

  const slug = slugFor(dest);

  /* Held together with the slug it belongs to, so "still loading" is derived
     from a mismatch rather than stored as a second flag that can disagree —
     and so the answer to a destination the person has already moved on from
     can never be shown under the new one. */
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    let alive = true;
    actions.loadGuide(slug).then((g) => { if (alive) setLoaded({ slug, guide: g ?? null }); });
    return () => { alive = false; };
  }, [slug, actions]);

  const loading = loaded?.slug !== slug;
  const guide = loading ? null : loaded.guide;

  const write = async () => {
    setBusy(true);
    setError('');
    setConfirmDrop(false);
    try {
      const fresh = await generateGuide({ dest });
      await actions.saveGuide(slug, fresh);
      setLoaded({ slug, guide: fresh });
      notify(`Đã soạn cẩm nang cho ${dest}`, 'sage');
    } catch (err) {
      console.error('SmartTrip · cẩm nang:', err);
      setError(err?.message || 'Không soạn được cẩm nang. Thử lại giúp mình.');
    } finally {
      setBusy(false);
    }
  };

  const drop = async () => {
    setConfirmDrop(false);
    await actions.removeGuide(slug);
    setLoaded({ slug, guide: null });
    notify('Đã xoá cẩm nang', 'neutral');
  };

  const pick = (name) => {
    setDest(name);
    setError('');
    setConfirmDrop(false);
  };

  const openTyped = () => {
    const name = typed.trim();
    if (!name) return;
    pick(name);
    setTyped('');
  };

  return (
    <div className="st-rise" style={{ marginTop: 26 }}>
      <header style={{ maxWidth: '70ch' }}>
        <h3 style={{ margin: 0, fontSize: 21 }}>Cẩm nang bản địa<En> · Local guidebook</En></h3>
        <p className="text-muted" style={{ fontSize: 13.5, margin: '8px 0 0' }}>
          Tiền bạc, đi lại, phép lịch sự và những câu cần nói — soạn một lần cho mỗi nơi,
          rồi nằm sẵn trong máy để đọc được cả khi mất mạng.
        </p>
        {!aiAvailable && (
          <p className="st-hint" style={{ marginTop: 16, display: 'inline-flex' }}>
            Chưa nối Firebase AI Logic — đang dựng cẩm nang mẫu. Xem README để bật Gemini.
          </p>
        )}
      </header>

      <div className="st-guide-picker">
        <span className="text-muted" style={{ fontSize: 12.5, fontWeight: 700 }}>Nơi đến</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {suggestions.map((name) => (
            <button key={slugFor(name)} type="button"
              className={`st-chip ${slugFor(name) === slug ? 'active' : ''}`}
              aria-pressed={slugFor(name) === slug} onClick={() => pick(name)}>
              {name}
            </button>
          ))}
          {!suggestions.some((n) => slugFor(n) === slug) && (
            <span className="st-chip active" aria-current="true">{dest}</span>
          )}
        </div>
        <div className="st-guide-add">
          <input className="input" value={typed} placeholder="Nơi khác — vd: Chiang Mai, Thái Lan"
            aria-label="Soạn cẩm nang cho một nơi khác"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); openTyped(); } }} />
          <button type="button" className="btn btn-ghost" onClick={openTyped} disabled={!typed.trim()}>
            Mở
          </button>
        </div>
      </div>

      {error && <p className="st-error" style={{ marginTop: 16 }}>{error}</p>}

      {busy && <GuideSkeleton />}

      {!busy && loading && (
        <p className="text-muted" style={{ fontSize: 13.5, marginTop: 24 }}>Đang mở cẩm nang…</p>
      )}

      {!busy && !loading && !guide && (
        <div className="st-empty" style={{ marginTop: 24 }}>
          <h4>Chưa có cẩm nang cho {dest}</h4>
          <p>
            {editable
              ? 'Soạn một lần rồi cả nhóm cùng đọc — và bản sao vẫn nằm trong máy khi bạn không có mạng.'
              : 'Nhờ người có quyền Sửa trong chuyến đi soạn giúp một bản.'}
          </p>
          {editable && (
            <button type="button" className="btn btn-primary" onClick={write}>
              <Compass width="15" height="15" />Soạn cẩm nang
            </button>
          )}
        </div>
      )}

      {!busy && guide && (
        <div className="st-guide">
          <div className="st-metarow" style={{ marginBottom: 18 }}>
            <span className="tag tag-accent">{guide.dest || dest}</span>
            {guide.lang && <span className="tag">{guide.lang}</span>}
            {guide.currency && <span className="tag tag-neutral">{guide.currency}</span>}
          </div>

          {guide.summary && <p className="st-lede" style={{ margin: '0 0 24px', fontSize: 15 }}>{guide.summary}</p>}

          {/* keyed by position: nothing here reorders, and a model is perfectly
              capable of handing back two sections with the same title */}
          {guide.sections.map((sec, i) => (
            <section key={`${i}-${sec.title}`} className="st-guide-sec">
              <h4>{sec.title}</h4>
              <ul>
                {sec.tips.map((tip, j) => <li key={`${j}-${tip.slice(0, 24)}`}>{tip}</li>)}
              </ul>
            </section>
          ))}

          {guide.phrases.length > 0 && (
            <section className="st-guide-sec">
              <h4>Câu cần có sẵn<En> · Phrases</En></h4>
              <div className="st-phrases">
                {guide.phrases.map((p, i) => (
                  <div key={`${i}-${p.vi}`} className="st-phrase">
                    <span className="st-phrase-vi">{p.vi}</span>
                    {/* the line the person points at, so it is the big one */}
                    <span className="st-phrase-local">{p.local}</span>
                    {p.roman && <span className="st-phrase-roman">đọc: {p.roman}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {guide.emergency.length > 0 && (
            <section className="st-guide-sec">
              <h4>Khi có chuyện<En> · Emergency</En></h4>
              <div className="st-guide-sos">
                {guide.emergency.map((e, i) => (
                  <div key={`${i}-${e.label}`}>
                    <span>{e.label}</span>
                    <b>{e.value}</b>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="st-fineprint" style={{ maxWidth: '68ch' }}>
            Do mô hình soạn — số điện thoại, giá vé và giờ giấc nên kiểm lại trước khi cần tới.
          </p>

          {editable && (
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              {!confirmDrop ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={write}>
                    <Compass width="15" height="15" />Soạn lại
                  </button>
                  <button type="button" className="btn btn-ghost st-danger" onClick={() => setConfirmDrop(true)}>
                    Xoá cẩm nang
                  </button>
                </>
              ) : (
                <div className="st-hint" role="alert">
                  <span>Xoá cẩm nang của <b>{guide.dest || dest}</b>? Soạn lại được, nhưng là một lượt gọi AI nữa.</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost st-danger" onClick={drop}>
                    <Check width="14" height="14" />Xoá
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmDrop(false)}>Giữ lại</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
