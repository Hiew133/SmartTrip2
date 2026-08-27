import { useState } from 'react';
import { useApp, useActiveTrip } from '../../store.jsx';
import { dayLabel, fmt, hasCoords, newDay, newStop } from '../../data.js';
import { Grip, Route, Seg, Plus, Check } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';

/* Nearest-neighbour reorder: keep the first stop, then always hop to the
   closest remaining one. Each stop carries its own time along with it — the
   route may change, but "18:30 · bàn hải sản đã đặt" stays at 18:30. Stops
   with no coordinates yet are left at the end, in their original order. */
function optimizeRoute(items) {
  const located = items.filter(hasCoords);
  const rest = items.filter((s) => !hasCoords(s));
  if (located.length < 3) return items;

  const left = located.slice(1);
  const route = [located[0]];
  while (left.length) {
    const cur = route[route.length - 1];
    let best = 0, bestD = Infinity;
    left.forEach((s, i) => {
      const d = (s.lat - cur.lat) ** 2 + (s.lng - cur.lng) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    route.push(left.splice(best, 1)[0]);
  }
  return [...route, ...rest];
}

const asMinutes = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.time || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const isOutOfOrder = (items) => items.some((it, i) => {
  if (i === 0) return false;
  const a = asMinutes(items[i - 1]), b = asMinutes(it);
  return a !== null && b !== null && b < a;
});

const byTime = (items) => items
  .map((s, i) => ({ s, i }))
  .sort((x, y) => (asMinutes(x.s) ?? 1e9) - (asMinutes(y.s) ?? 1e9) || x.i - y.i)
  .map(({ s }) => s);

function StopEditor({ stop, onChange, onDone, onRemove }) {
  return (
    <div className="st-stopedit">
      <div className="st-stopedit-grid">
        <label>
          <span>Giờ</span>
          <input className="input" type="time" value={/^\d{1,2}:\d{2}$/.test(stop.time) ? stop.time : ''}
            onChange={(e) => onChange({ time: e.target.value || '--:--' })} />
        </label>
        <label className="st-stopedit-wide">
          <span>Tên điểm dừng</span>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input className="input" autoFocus value={stop.name} placeholder="vd: Bún chả cá Hờn"
            onChange={(e) => onChange({ name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onDone()} />
        </label>
        <label>
          <span>Dự chi (₫)</span>
          <input className="input" inputMode="numeric" value={stop.cost || ''} placeholder="0"
            onChange={(e) => onChange({ cost: parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0 })} />
        </label>
        <label className="st-stopedit-wide">
          <span>Ghi chú</span>
          <input className="input" value={stop.note} placeholder="vd: đặt bàn trước một ngày"
            onChange={(e) => onChange({ note: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onDone()} />
        </label>
      </div>
      <div className="st-stopedit-foot">
        <span className="text-muted" style={{ fontSize: 12 }}>
          {hasCoords(stop) ? 'Đã có toạ độ trên bản đồ' : 'Chưa có toạ độ — điểm này chưa hiện trên bản đồ'}
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost st-danger" onClick={onRemove}>Xoá điểm dừng</button>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          <Check width="14" height="14" />Xong
        </button>
      </div>
    </div>
  );
}

export default function ItineraryTab() {
  const { state, patch, patchTrip } = useApp();
  const trip = useActiveTrip();
  const [dragIdx, setDragIdx] = useState(-1);
  const [overIdx, setOverIdx] = useState(-1);
  const [undo, setUndo] = useState(null);       // { dayId, items, label }
  const [editId, setEditId] = useState(null);
  const [confirmDay, setConfirmDay] = useState(false);

  // state.day is UI state and the day list can shrink under it, so never index blindly
  const dayIdx = Math.min(Math.max(state.day, 0), Math.max(trip.days.length - 1, 0));
  const day = trip.days[dayIdx] ?? null;
  const daySpend = day ? day.items.reduce((s, i) => s + i.cost, 0) : 0;

  const writeItems = (dayId, items) => patchTrip((t) => ({
    days: t.days.map((d) => (d.id === dayId ? { ...d, items } : d)),
  }));

  /* Every reordering keeps the previous order around for one undo — the old
     version rewrote the day in place with no way back. */
  const reorder = (items, label) => {
    setUndo({ dayId: day.id, items: day.items, label });
    writeItems(day.id, items);
    patch({ focusIdx: -1 });
  };

  const applyUndo = () => {
    writeItems(undo.dayId, undo.items);
    setUndo(null);
    patch({ focusIdx: -1 });
  };

  const selectDay = (i) => {
    patch({ day: i, focusIdx: -1 });
    setUndo(null); setEditId(null); setConfirmDay(false);
  };

  const onDrop = (to) => {
    if (dragIdx < 0 || dragIdx === to) return;
    const items = day.items.slice();
    const [moved] = items.splice(dragIdx, 1);
    items.splice(to, 0, moved);
    reorder(items, 'đổi thứ tự');
  };

  const addDay = () => {
    const d = newDay({ place: `Ngày ${trip.days.length + 1}` });
    patchTrip((t) => ({ days: [...t.days, d] }));
    patch({ day: trip.days.length, focusIdx: -1 });
    setUndo(null); setEditId(null);
  };

  const removeDay = () => {
    patchTrip((t) => ({ days: t.days.filter((d) => d.id !== day.id) }));
    patch({ day: Math.max(0, dayIdx - 1), focusIdx: -1 });
    setUndo(null); setEditId(null); setConfirmDay(false);
  };

  const addStop = () => {
    const s = newStop();
    writeItems(day.id, [...day.items, s]);
    setEditId(s.id);
  };

  const editStop = (id, fields) => writeItems(day.id, day.items.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  const removeStop = (id) => {
    writeItems(day.id, day.items.filter((s) => s.id !== id));
    setEditId(null);
    patch({ focusIdx: -1 });
  };

  const outOfOrder = day ? isOutOfOrder(day.items) : false;

  return (
    <div className="st-2col">
      <section aria-label="Lịch trình theo ngày">
        <div className="st-datefields">
          <label className="field">
            <span>Ngày đi</span>
            <input className="input" type="date" value={trip.startDate ?? ''}
              onChange={(e) => patchTrip(() => ({ startDate: e.target.value || null }))} />
          </label>
          <label className="field">
            <span>Ngày về</span>
            <input className="input" type="date" value={trip.endDate ?? ''} min={trip.startDate ?? undefined}
              onChange={(e) => patchTrip(() => ({ endDate: e.target.value || null }))} />
          </label>
        </div>

        <div className="st-dayhead">
          {trip.days.length > 0 && (
            <Seg ariaLabel="Chọn ngày" options={trip.days.map((d, i) => ({
              key: d.id, label: `Ngày ${i + 1}`, active: i === dayIdx, onClick: () => selectDay(i),
            }))} />
          )}
          <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={addDay}>
            <Plus width="15" height="15" />Thêm ngày
          </button>
          {day && day.items.length > 2 && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }}
              onClick={() => reorder(optimizeRoute(day.items), 'tối ưu tuyến đường')}>
              <Route width="15" height="15" />Tối ưu tuyến đường
            </button>
          )}
        </div>

        {!day ? (
          <div className="st-empty">
            <h4>Chuyến đi chưa có ngày nào</h4>
            <p>Thêm ngày đầu tiên rồi bắt đầu ghi các điểm dừng cho hôm đó.</p>
            <button type="button" className="btn btn-primary" onClick={addDay}>
              <Plus width="15" height="15" />Thêm ngày
            </button>
          </div>
        ) : (
          <>
            <div className="st-daytitlerow">
              <input className="st-daytitle st-titlefield" value={day.place} placeholder="Đặt tên cho ngày này"
                aria-label={`Tên ngày ${dayIdx + 1}`}
                onChange={(e) => patchTrip((t) => ({
                  days: t.days.map((d) => (d.id === day.id ? { ...d, place: e.target.value } : d)),
                }))} />
              {confirmDay ? (
                <span className="st-confirm">
                  <button type="button" className="btn btn-ghost st-danger" onClick={removeDay}>Xoá cả ngày?</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmDay(false)}>Giữ lại</button>
                </span>
              ) : (
                <button type="button" className="btn btn-ghost st-danger" style={{ fontSize: 13 }}
                  onClick={() => setConfirmDay(true)}>Xoá ngày</button>
              )}
            </div>
            <p className="st-daysub">
              {dayLabel(trip.startDate, dayIdx)} · {day.items.length} điểm dừng · dự chi {fmt(daySpend)}
              {day.items.length > 0 && ' — chạm để định vị trên bản đồ, kéo để đổi thứ tự'}
            </p>

            {undo && (
              <div className="st-undo" role="status">
                <span>Đã {undo.label}.</span>
                <button type="button" className="btn btn-ghost" onClick={applyUndo}>Hoàn tác</button>
              </div>
            )}

            {outOfOrder && (
              <div className="st-hint" role="status">
                <span>Thứ tự hiện tại không khớp với giờ đã ghi.</span>
                <button type="button" className="btn btn-ghost"
                  onClick={() => reorder(byTime(day.items), 'sắp lại theo giờ')}>
                  Sắp lại theo giờ
                </button>
              </div>
            )}

            {day.items.length === 0 ? (
              <div className="st-empty">
                <h4>Ngày này chưa có điểm dừng</h4>
                <p>Thêm điểm dừng đầu tiên để bắt đầu dựng lịch trình cho hôm đó.</p>
                <button type="button" className="btn btn-primary" onClick={addStop}>
                  <Plus width="15" height="15" />Thêm điểm dừng
                </button>
              </div>
            ) : (
              <ol className="st-stops st-stagger" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {day.items.map((it, i) => (
                  <li key={it.id}>
                    {editId === it.id ? (
                      <StopEditor stop={it}
                        onChange={(fields) => editStop(it.id, fields)}
                        onDone={() => setEditId(null)}
                        onRemove={() => removeStop(it.id)} />
                    ) : (
                      <div
                        className={[
                          'st-stop',
                          state.focusIdx === i ? 'active' : '',
                          dragIdx === i ? 'dragging' : '',
                          overIdx === i && dragIdx !== i ? 'drag-over' : '',
                        ].join(' ')}
                        draggable
                        onDragStart={() => setDragIdx(i)}
                        onDragEnd={() => { setDragIdx(-1); setOverIdx(-1); }}
                        onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                        onDrop={(e) => { e.preventDefault(); onDrop(i); setDragIdx(-1); setOverIdx(-1); }}
                        role="button" tabIndex={0} aria-label={`Xem ${it.name || 'điểm dừng'} trên bản đồ`}
                        aria-pressed={state.focusIdx === i}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), patch({ focusIdx: i }))}
                        onClick={() => patch({ focusIdx: i })}>
                        <Grip className="st-grip" />
                        <span className="st-stop-num">{i + 1}</span>
                        <span className="st-stop-time">{it.time}</span>
                        <span>
                          <span className="st-stop-name">{it.name || 'Điểm dừng chưa đặt tên'}</span>
                          <span className="st-stop-note">{it.note}</span>
                        </span>
                        <span className={`st-stop-cost ${it.cost ? '' : 'free'}`}>
                          {it.cost ? fmt(it.cost) : 'Miễn phí'}
                        </span>
                        <button type="button" className="st-stop-edit"
                          aria-label={`Sửa ${it.name || 'điểm dừng'}`}
                          onClick={(e) => { e.stopPropagation(); setEditId(it.id); }}>
                          Sửa
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {day.items.length > 0 && (
              <button type="button" className="btn btn-secondary" style={{ marginTop: 18 }} onClick={addStop}>
                <Plus width="15" height="15" />Thêm điểm dừng
              </button>
            )}
          </>
        )}
      </section>

      <figure className="st-mapfig">
        <MapView stops={day?.items ?? []} focusIdx={state.focusIdx} style={{ height: 580 }} />
        <figcaption style={{ marginTop: 10, fontSize: 12 }}>
          Bản đồ © OpenStreetMap · ghim đang chọn đổi sang màu rêu
          <span className="st-en"> · tap a stop to locate it</span>
        </figcaption>
      </figure>
    </div>
  );
}
