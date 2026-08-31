import { useState } from 'react';
import { useApp } from '../store.jsx';
import { fmt, parseISO } from '../data.js';
import { aiAvailable, generateItinerary } from '../backend/index.js';
import { ArrowRight, Compass, En, Seg } from '../components/ui.jsx';

const STYLE_CHIPS = ['Ẩm thực', 'Biển đảo', 'Văn hoá', 'Nghỉ dưỡng', 'Chụp ảnh', 'Khám phá đêm'];
const PARTY_SIZE = { 'Một mình': 1, 'Cặp đôi': 2, 'Nhóm bạn': 4, 'Gia đình': 4 };

const parseAmount = (raw) => parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10) || 0;

const addDays = (iso, n) => {
  const d = parseISO(iso);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const draftTotal = (days) => days.reduce((s, d) => s + d.items.reduce((x, i) => x + i.cost, 0), 0);

/* The wait shows the shape of the answer forming, not a spinning circle. */
function DraftSkeleton({ days }) {
  return (
    <div style={{ marginTop: 34 }} aria-live="polite" aria-busy="true">
      <div className="st-metarow" style={{ marginBottom: 20 }}>
        <span className="st-skel" style={{ width: 96, height: 22, borderRadius: 999 }} />
        <span className="st-skel" style={{ width: 148, height: 22, borderRadius: 999 }} />
        <span className="st-skel" style={{ width: 120, height: 22, borderRadius: 999 }} />
      </div>
      <div className="st-aicard">
        <div className="st-aidays">
          {Array.from({ length: days }, (_, d) => (
            <div key={d} className="st-aiday">
              <span className="st-skel" style={{ display: 'block', width: '68%', height: 17, marginBottom: 15 }} />
              {Array.from({ length: 3 + (d % 3) }, (_, r) => (
                <div key={r} className="st-aistop" style={{ marginBottom: 11 }}>
                  <span className="st-skel" style={{ width: 34, height: 11, flex: 'none' }} />
                  <span className="st-skel" style={{ width: `${58 + ((d + r) % 4) * 10}%`, height: 11 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-muted" style={{ fontSize: 13.5, fontWeight: 600, marginTop: 20 }}>
        Đang đọc bản đồ, cân ngân sách và xếp từng buổi…
      </p>
    </div>
  );
}

export default function AIDesk() {
  const { state, patch, actions } = useApp();
  /* Creating the trip is a network round-trip, and the button stays clickable
     the whole way there — a second press was making a second trip. */
  const [saving, setSaving] = useState(false);

  const party = PARTY_SIZE[state.aiParty] ?? 1;
  const budgetPerPerson = parseAmount(state.aiBudget);
  const budgetTotal = budgetPerPerson * party;
  const draft = state.aiDraft;
  const total = draft ? draftTotal(draft.days) : 0;
  const slack = draft && budgetTotal > 0 ? Math.round(((budgetTotal - total) / budgetTotal) * 100) : null;

  const generate = async () => {
    patch({ aiPhase: 'loading', aiError: '', aiDraft: null });
    try {
      const result = await generateItinerary({
        dest: state.aiDest,
        date: state.aiDate,
        dayCount: state.aiDaysN,
        party: state.aiParty,
        partySize: party,
        pace: state.aiPace,
        styles: Object.keys(state.aiStyles).filter((k) => state.aiStyles[k]),
        budgetPerPerson,
      });
      patch({ aiDraft: result, aiPhase: 'result' });
    } catch (err) {
      console.error('SmartTrip · AI:', err);
      patch({ aiPhase: 'form', aiError: err?.message || 'Không soạn được lịch trình. Thử lại giúp mình.' });
    }
  };

  const useDraft = async () => {
    if (saving) return;
    setSaving(true);
    const id = await actions.createTrip({
      title: draft.title || state.aiDest.split(',')[0].trim() || 'Chuyến đi mới',
      seed: `ai-${Math.random().toString(36).slice(2, 8)}`,
      alt: 'Ảnh bìa chuyến đi do AI soạn',
      body: draft.summary || `Bản nháp AI · ${state.aiParty} · nhịp ${state.aiPace.toLowerCase()}.`,
      startDate: state.aiDate || null,
      endDate: addDays(state.aiDate, draft.days.length - 1),
      plan: budgetTotal,
      days: draft.days,
    });
    // a used draft is spent — coming back to the desk should offer a fresh form
    if (id) patch({ aiPhase: 'form', aiDraft: null });
    else setSaving(false);          // the toast said why; the draft is still here to retry
  };

  return (
    <div className="st-page st-page-narrow">
      <header className="st-rise">
        <span className="st-eyebrow">Bàn soạn lịch trình<En>&nbsp;· AI trip desk</En></span>
        <h1 className="st-display">Soạn lịch trình bằng AI</h1>
        <p className="st-lede" style={{ margin: '14px 0 0' }}>
          Cho SmartTrip biết bạn muốn đi đâu và đi kiểu gì. Bản nháp trả về theo từng ngày,
          xếp vừa ngân sách, kèm giờ giấc và điểm dừng có thật.
        </p>
        {!aiAvailable && (
          <p className="st-hint" style={{ marginTop: 18, display: 'inline-flex' }}>
            Chưa nối Firebase AI Logic — đang trả bản nháp mẫu. Xem README để bật Gemini.
          </p>
        )}
      </header>

      {state.aiPhase === 'form' && (
        <div className="st-aigrid st-rise">
          <div className="field st-full">
            <label htmlFor="ai-dest">Điểm đến<En> · Destination</En></label>
            <input className="input" id="ai-dest" value={state.aiDest}
              onChange={(e) => patch({ aiDest: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ai-date">Ngày khởi hành</label>
            <input className="input" id="ai-date" type="date" value={state.aiDate}
              onChange={(e) => patch({ aiDate: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ai-budget">Ngân sách mỗi người</label>
            <input className="input" id="ai-budget" value={state.aiBudget}
              onChange={(e) => patch({ aiBudget: e.target.value })} />
          </div>
          <div className="field">
            <label>Số ngày</label>
            <Seg ariaLabel="Số ngày" options={[2, 3, 4, 5].map((n) => ({
              label: `${n} ngày`, active: state.aiDaysN === n, onClick: () => patch({ aiDaysN: n }),
            }))} />
          </div>
          <div className="field">
            <label>Đi cùng</label>
            <Seg ariaLabel="Đi cùng ai" options={Object.keys(PARTY_SIZE).map((p) => ({
              label: p, active: state.aiParty === p, onClick: () => patch({ aiParty: p }),
              style: { padding: '7px 13px' },
            }))} />
          </div>
          <div className="field">
            <label>Nhịp độ</label>
            <Seg ariaLabel="Nhịp độ chuyến đi" options={['Thư thả', 'Cân bằng', 'Kín lịch'].map((p) => ({
              label: p, active: state.aiPace === p, onClick: () => patch({ aiPace: p }),
            }))} />
          </div>
          <div className="field st-full">
            <label>Phong cách chuyến đi<En> · Travel style</En></label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STYLE_CHIPS.map((c) => {
                const on = !!state.aiStyles[c];
                return (
                  <button key={c} type="button" className={`st-chip ${on ? 'active' : ''}`} aria-pressed={on}
                    onClick={() => patch((s) => ({ aiStyles: { ...s.aiStyles, [c]: !on } }))}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="st-full" style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={generate}>
              <Compass width="15" height="15" />Soạn lịch trình
            </button>
            <span className="text-muted" style={{ fontSize: 13.5, fontWeight: 600 }}>
              Bản nháp mất vài giây · chỉnh tay thoải mái sau đó
            </span>
          </div>
          {state.aiError && <p className="st-error st-full">{state.aiError}</p>}
        </div>
      )}

      {state.aiPhase === 'loading' && <DraftSkeleton days={state.aiDaysN} />}

      {state.aiPhase === 'result' && draft && (
        <div style={{ marginTop: 34 }} className="st-rise">
          <div className="st-metarow" style={{ marginBottom: 20 }}>
            <span className="tag tag-accent">Bản nháp 1</span>
            <span className="tag tag-neutral">{draft.title}</span>
            <span className="tag tag-neutral">{draft.days.length} ngày · {state.aiParty}</span>
            <span className="tag tag-accent-2">≈ {fmt(total / party)}/người</span>
          </div>
          <div className="st-aicard">
            <div className="st-aidays st-stagger">
              {draft.days.map((d, i) => (
                <div key={d.id} className="st-aiday">
                  <h4><span className="st-aiday-n">{i + 1}</span>{d.place}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {d.items.map((it) => (
                      <div key={it.id} className="st-aistop">
                        <span className="st-aistop-t">{it.time}</span>
                        <span className="st-aistop-n">{it.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: 13.5, margin: '20px 0 0', maxWidth: '68ch' }}>
            {draft.summary && `${draft.summary} `}
            Ước tính {fmt(total)} cho cả nhóm
            {slack !== null && (slack >= 0
              ? `, còn dư khoảng ${slack}% ngân sách làm dự phòng.`
              : `, vượt ngân sách khoảng ${Math.abs(slack)}%.`)}
            {slack === null && '.'}
          </p>
          <p className="st-fineprint" style={{ maxWidth: '68ch' }}>
            Giá và toạ độ do mô hình ước tính — kiểm tra lại trước khi đặt chỗ.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={useDraft} disabled={saving}>
              {saving ? 'Đang tạo chuyến đi…' : <>Dùng lịch trình này<ArrowRight width="15" height="15" /></>}
            </button>
            <button type="button" className="btn btn-secondary" disabled={saving}
              onClick={() => patch({ aiPhase: 'form', aiDraft: null })}>
              Soạn lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
