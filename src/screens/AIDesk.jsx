import { useEffect, useRef } from 'react';
import { useApp } from '../store.jsx';
import { ArrowRight, Compass, Seg } from '../components/ui.jsx';

const STYLE_CHIPS = ['Ẩm thực', 'Biển đảo', 'Văn hoá', 'Nghỉ dưỡng', 'Chụp ảnh', 'Khám phá đêm'];

/* The wait shows the shape of the answer forming, not a spinning circle. */
function DraftSkeleton() {
  return (
    <div style={{ marginTop: 34 }} aria-live="polite" aria-busy="true">
      <div className="st-metarow" style={{ marginBottom: 20 }}>
        <span className="st-skel" style={{ width: 96, height: 22, borderRadius: 999 }} />
        <span className="st-skel" style={{ width: 148, height: 22, borderRadius: 999 }} />
        <span className="st-skel" style={{ width: 120, height: 22, borderRadius: 999 }} />
      </div>
      <div className="st-aicard">
        <div className="st-aidays">
          {[5, 3, 4, 3].map((rows, d) => (
            <div key={d} className="st-aiday">
              <span className="st-skel" style={{ display: 'block', width: '68%', height: 17, marginBottom: 15 }} />
              {Array.from({ length: rows }, (_, r) => (
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

  const generate = () => {
    patch({ aiPhase: 'loading' });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => patch({ aiPhase: 'result' }), 1700);
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
            <Seg ariaLabel="Đi cùng ai" options={['Một mình', 'Cặp đôi', 'Nhóm bạn', 'Gia đình'].map((p) => ({
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

      {state.aiPhase === 'loading' && <DraftSkeleton />}

      {state.aiPhase === 'result' && (
        <div style={{ marginTop: 34 }} className="st-rise">
          <div className="st-metarow" style={{ marginBottom: 20 }}>
            <span className="tag tag-accent">Bản nháp 1</span>
            <span className="tag tag-neutral">Đà Nẵng – Hội An</span>
            <span className="tag tag-neutral">{state.aiDaysN} ngày · {state.aiParty}</span>
            <span className="tag tag-accent-2">≈ 3.727.500 ₫/người</span>
          </div>
          <div className="st-aicard">
            <div className="st-aidays st-stagger">
              {state.days.map((d, i) => (
                <div key={d.place} className="st-aiday">
                  <h4><span className="st-aiday-n">{i + 1}</span>{d.place}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {d.items.map((it) => (
                      <div key={it.n} className="st-aistop">
                        <span className="st-aistop-t">{it.t}</span>
                        <span className="st-aistop-n">{it.n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: 13.5, margin: '20px 0 0', maxWidth: '68ch' }}>
            Ước tính 14.910.000 ₫ cho cả nhóm, còn dư khoảng 7% ngân sách làm dự phòng.
            Giá vé lấy theo mùa thấp điểm tháng 9.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary"
              onClick={() => go('trip', { tripTab: 'itin', day: 0, aiPhase: 'form' })}>
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
