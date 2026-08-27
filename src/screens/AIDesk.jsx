import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../store.jsx';
import { SEED_TRIPS, fmt, newTrip, parseISO, uid } from '../data.js';
import { ArrowRight, Compass, Seg } from '../components/ui.jsx';

const STYLE_CHIPS = ['Ẩm thực', 'Biển đảo', 'Văn hoá', 'Nghỉ dưỡng', 'Chụp ảnh', 'Khám phá đêm'];
const PARTY_SIZE = { 'Một mình': 1, 'Cặp đôi': 2, 'Nhóm bạn': 4, 'Gia đình': 4 };

const parseAmount = (raw) => parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10) || 0;

const addDays = (iso, n) => {
  const d = parseISO(iso);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
  const { state, patch, go } = useApp();
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  /* Still a mock — but it now returns exactly the number of days that was
     asked for, and every figure below is computed from what it returns
     instead of being a number typed into the markup. */
  const draftDays = useMemo(() => {
    const source = SEED_TRIPS[0].days;
    return Array.from({ length: state.aiDaysN }, (_, i) => {
      const d = source[i % source.length];
      return { ...d, id: uid('day'), items: d.items.map((s) => ({ ...s, id: uid('stop') })) };
    });
  }, [state.aiDaysN]);

  const party = PARTY_SIZE[state.aiParty] ?? 1;
  const draftTotal = draftDays.reduce((s, d) => s + d.items.reduce((x, i) => x + i.cost, 0), 0);
  const budgetTotal = parseAmount(state.aiBudget) * party;
  const slack = budgetTotal > 0 ? Math.round(((budgetTotal - draftTotal) / budgetTotal) * 100) : null;

  const generate = () => {
    patch({ aiPhase: 'loading' });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => patch({ aiPhase: 'result' }), 1700);
  };

  const useDraft = () => {
    const trip = newTrip({
      title: state.aiDest.split(',')[0].trim() || 'Chuyến đi mới',
      seed: SEED_TRIPS[0].seed,
      alt: 'Ảnh bìa chuyến đi do AI soạn',
      body: `Bản nháp AI · ${state.aiParty} · nhịp ${state.aiPace.toLowerCase()}.`,
      startDate: state.aiDate || null,
      endDate: addDays(state.aiDate, state.aiDaysN - 1),
      plan: budgetTotal,
      days: draftDays,
    });
    patch((s) => ({ trips: [...s.trips, trip] }));
    go('trip', { activeTripId: trip.id, tripTab: 'itin', day: 0, focusIdx: -1, mDay: 0, mFocus: -1, aiPhase: 'form' });
  };

  return (
    <div className="st-page st-page-narrow">
      <header className="st-rise">
        <span className="st-eyebrow">Bàn soạn lịch trình<span className="st-en">&nbsp;· AI trip desk</span></span>
        <h1 className="st-display">Soạn lịch trình bằng AI</h1>
        <p className="st-lede" style={{ margin: '14px 0 0' }}>
          Cho SmartTrip biết bạn muốn đi đâu và đi kiểu gì. Bản nháp trả về theo từng ngày,
          xếp vừa ngân sách, kèm giờ giấc và điểm dừng có thật.
        </p>
      </header>

      {state.aiPhase === 'form' && (
        <div className="st-aigrid st-rise">
          <div className="field st-full">
            <label htmlFor="ai-dest">Điểm đến<span className="st-en"> · Destination</span></label>
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
            <label>Phong cách chuyến đi<span className="st-en"> · Travel style</span></label>
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
              Bản nháp mất khoảng hai giây · chỉnh tay thoải mái sau đó
            </span>
          </div>
        </div>
      )}

      {state.aiPhase === 'loading' && <DraftSkeleton days={state.aiDaysN} />}

      {state.aiPhase === 'result' && (
        <div style={{ marginTop: 34 }} className="st-rise">
          <div className="st-metarow" style={{ marginBottom: 20 }}>
            <span className="tag tag-accent">Bản nháp 1</span>
            <span className="tag tag-neutral">{state.aiDest.split(',')[0].trim()}</span>
            <span className="tag tag-neutral">{state.aiDaysN} ngày · {state.aiParty}</span>
            <span className="tag tag-accent-2">≈ {fmt(draftTotal / party)}/người</span>
          </div>
          <div className="st-aicard">
            <div className="st-aidays st-stagger">
              {draftDays.map((d, i) => (
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
            Ước tính {fmt(draftTotal)} cho cả nhóm
            {slack !== null && (slack >= 0
              ? `, còn dư khoảng ${slack}% ngân sách làm dự phòng.`
              : `, vượt ngân sách khoảng ${Math.abs(slack)}%.`)}
            {slack === null && '.'} Giá vé lấy theo mùa thấp điểm tháng 9.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={useDraft}>
              Dùng lịch trình này<ArrowRight width="15" height="15" />
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => patch({ aiPhase: 'form' })}>
              Soạn lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
