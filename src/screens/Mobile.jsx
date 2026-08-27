import { useApp, useActiveTrip } from '../store.jsx';
import { fmt, formatRange } from '../data.js';
import { Avatar, Pin, muted } from '../components/ui.jsx';
import IOSDevice from '../components/IOSDevice.jsx';
import MapView from '../components/MapView.jsx';

const STEPS = [
  <>Tab <b>Lịch trình / Bản đồ</b> chuyển bằng segmented control cao 44 px — vừa ngón cái.</>,
  <>Chạm một điểm dừng để nhảy sang bản đồ, mở đúng ghim đó.</>,
  <>Bản đồ phủ màu giấy ấm; ghim tròn theo màu đất nung, ghim đang chọn đổi sang màu rêu.</>,
];

export default function Mobile() {
  const { state, patch } = useApp();
  const trip = useActiveTrip();

  // the day list can be empty or shorter than the remembered index
  const mDayIdx = Math.min(Math.max(state.mDay, 0), Math.max(trip.days.length - 1, 0));
  const mDay = trip.days[mDayIdx] ?? null;
  const items = mDay?.items ?? [];

  return (
    <div className="st-page st-mobile">
      <section style={{ paddingTop: 32 }} className="st-rise">
        <span className="st-eyebrow">Bản điện thoại<span className="st-en">&nbsp;· Mobile companion</span></span>
        <h1 className="st-display" style={{ fontSize: 'clamp(32px, 3.4vw, 40px)' }}>SmartTrip trên đường đi</h1>
        <p className="st-lede" style={{ margin: '14px 0 28px', fontSize: 15 }}>
          Trong chuyến đi, hai tab là đủ: hôm nay đi đâu, và nó nằm ở đâu.
        </p>
        <div className="st-steps">
          {STEPS.map((s, i) => (
            <p key={i} className="st-step"><span className="st-step-n">{i + 1}</span><span>{s}</span></p>
          ))}
        </div>
      </section>

      <IOSDevice>
        <div style={{
          height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)',
          fontFamily: 'var(--font-body)', color: 'var(--color-text)', paddingTop: 58, boxSizing: 'border-box',
        }}>
          <div style={{ padding: '14px 18px 0', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Pin width="17" height="17" style={{ color: 'var(--color-accent)' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>SmartTrip</span>
            <span style={{ flex: 1 }} />
            <Avatar initial="M" size={28} />
          </div>
          <p style={{ margin: '4px 18px 0', fontSize: 12.5, fontWeight: 600, color: muted(60) }}>
            {trip.title} · {formatRange(trip.startDate, trip.endDate)}
          </p>

          <div className="st-phone-seg" role="group" aria-label="Lịch trình hoặc bản đồ">
            {[['itin', 'Lịch trình'], ['map', 'Bản đồ']].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={state.mTab === key}
                className={state.mTab === key ? 'active' : ''}
                onClick={() => patch({ mTab: key })}>{label}</button>
            ))}
          </div>

          {state.mTab === 'itin' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: 18 }}>
              <div style={{ display: 'flex', gap: 8, padding: '12px 16px 6px', overflowX: 'auto' }}>
                {trip.days.map((d, i) => (
                  <button key={d.id} type="button"
                    className={`st-chip ${i === mDayIdx ? 'active' : ''}`}
                    style={{ minHeight: 44, padding: '0 15px', flex: 'none' }}
                    onClick={() => patch({ mDay: i, mFocus: -1 })}>
                    Ngày {i + 1}
                  </button>
                ))}
              </div>
              {items.length === 0 ? (
                <p style={{ margin: '18px 18px 0', fontSize: 13.5, color: muted(60) }}>
                  Chuyến này chưa có điểm dừng nào. Thêm ở tab Lịch trình trên máy tính.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {items.map((it, i) => (
                    <button key={it.id} type="button" className="st-phone-row"
                      aria-label={`Xem ${it.name || 'điểm dừng'} trên bản đồ`}
                      onClick={() => patch({ mTab: 'map', mFocus: i })}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, flex: 'none', width: 42, color: 'var(--color-accent-700)' }}>
                        {it.time}
                      </span>
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
                        {it.name || 'Điểm dừng chưa đặt tên'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: muted(55) }}>
                        {it.cost ? fmt(it.cost) : '—'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {state.mTab === 'map' && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 12 }}>
              <MapView stops={items} focusIdx={state.mFocus} zoomControl={false}
                style={{ height: '100%', borderRadius: 0, border: 0, boxShadow: 'none' }} />
            </div>
          )}
        </div>
      </IOSDevice>
    </div>
  );
}
