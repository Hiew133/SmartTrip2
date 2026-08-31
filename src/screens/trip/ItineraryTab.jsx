import { Suspense, lazy, useState } from 'react';
import { useApp } from '../../store.jsx';
import { dayLabel, fmt, hasCoords, newDay, newStop } from '../../data.js';
import { byTime, isOutOfOrder, moveItem, optimizeRoute, routeLengthKm } from '../../itinerary.js';
import { Check, ChevronDown, ChevronUp, En, Grip, Plus, Route, Seg } from '../../components/ui.jsx';
import { useFieldDraft } from '../../components/useFieldDraft.js';
import PlaceSearch from '../../components/PlaceSearch.jsx';
/* Leaflet is 150 kB and only this tab needs it. People land on the trip list
   first, so loading it lazily takes it off the critical path for every screen
   before this one. The fallback is the same box at the same height, so nothing
   moves when it arrives. */
const MapView = lazy(() => import('../../components/MapView.jsx'));

/* Edits are held locally and written once, on Xong — a stop lives inside its
   day document, so committing per keystroke would rewrite the whole day. */
function StopEditor({ stop, onSave, onRemove }) {
  const [d, setD] = useState(stop);
  const set = (fields) => setD((prev) => ({ ...prev, ...fields }));

  return (
    <div className="st-stopedit">
      <div className="st-stopedit-grid">
        <label>
          <span>Giờ</span>
          <input className="input" type="time" value={/^\d{1,2}:\d{2}$/.test(d.time) ? d.time : ''}
            onChange={(e) => set({ time: e.target.value || '--:--' })} />
        </label>
        <label className="st-stopedit-wide">
          <span>Tên điểm dừng</span>
          <PlaceSearch
            value={d.name} autoFocus placeholder="vd: Bún chả cá Hờn"
            onText={(name) => set({ name })}
            onEnter={() => onSave(d)}
            /* Picking is the only way a hand-added stop ever gets coordinates.
               The address goes into the note only when the note is empty —
               it is the person's field, not a place to write over. */
            onPick={(p) => set({
              name: p.name,
              lat: p.lat,
              lng: p.lng,
              note: d.note.trim() ? d.note : p.address,
            })}
          />
        </label>
        <label>
          <span>Dự chi (₫)</span>
          <input className="input" inputMode="numeric" value={d.cost || ''} placeholder="0"
            onChange={(e) => set({ cost: parseInt(e.target.value.replace(/[^\d]/g, ''), 10) || 0 })} />
        </label>
        <label className="st-stopedit-wide">
          <span>Ghi chú</span>
          <input className="input" value={d.note} placeholder="vd: đặt bàn trước một ngày"
            onChange={(e) => set({ note: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onSave(d)} />
        </label>
      </div>
      <div className="st-stopedit-foot">
        {hasCoords(d) ? (
          <span className="text-muted" style={{ fontSize: 12 }}>
            Đã ghim tại {d.lat.toFixed(4)}, {d.lng.toFixed(4)}
            {' · '}
            <button type="button" className="st-linkbtn" onClick={() => set({ lat: null, lng: null })}>
              bỏ toạ độ
            </button>
          </span>
        ) : (
          <span className="text-muted" style={{ fontSize: 12 }}>
            Chưa có toạ độ — chọn một gợi ý ở ô tên để ghim lên bản đồ
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost st-danger" onClick={onRemove}>Xoá điểm dừng</button>
        <button type="button" className="btn btn-primary" onClick={() => onSave(d)}>
          <Check width="14" height="14" />Xong
        </button>
      </div>
    </div>
  );
}

export default function ItineraryTab({ trip, editable }) {
  const { state, patch, notify, actions } = useApp();
  const [dragIdx, setDragIdx] = useState(-1);
  const [overIdx, setOverIdx] = useState(-1);
  const [undo, setUndo] = useState(null);       // { dayId, items, label }
  const [editId, setEditId] = useState(null);
  const [confirmDay, setConfirmDay] = useState(false);

  // state.day is UI state and the day list can shrink under it, so never index blindly
  const dayIdx = Math.min(Math.max(state.day, 0), Math.max(trip.days.length - 1, 0));
  const day = trip.days[dayIdx] ?? null;
  const daySpend = day ? day.items.reduce((s, i) => s + i.cost, 0) : 0;

  const place = useFieldDraft(day?.place, (v) => actions.updateDay(day.id, { place: v }));

  const writeItems = (dayId, items) => actions.updateDay(dayId, { items });

  /* Every reordering keeps the previous order around for one undo — the old
     version rewrote the day in place with no way back. Dragging is its own
     feedback, so only the one-click reorders announce themselves. */
  const reorder = (items, label, announce = false) => {
    setUndo({ dayId: day.id, items: day.items, label });
    writeItems(day.id, items);
    patch({ focusIdx: -1 });
    if (announce) notify(`Đã ${label} — giờ của từng điểm dừng giữ nguyên`, 'sage');
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
    reorder(moveItem(day.items, dragIdx, to), 'đổi thứ tự');
  };

  /* Drag-and-drop is mouse-only: HTML5 DnD does not fire for touch, and there
     is no keyboard equivalent. These two buttons are the same move by another
     route, so a phone and a screen reader get the feature too. */
  const nudge = (from, delta) => {
    const to = from + delta;
    if (to < 0 || to >= day.items.length) return;
    reorder(moveItem(day.items, from, to), delta < 0 ? 'chuyển lên' : 'chuyển xuống');
    patch({ focusIdx: to });
  };

  const addDay = async () => {
    await actions.addDay(newDay({ place: `Ngày ${trip.days.length + 1}` }));
    patch({ day: trip.days.length, focusIdx: -1 });
    setUndo(null); setEditId(null);
  };

  /* Moving a day carries the selection with it, so the person keeps looking at
     the day they just moved rather than at whatever slid into its place. */
  const moveDay = (delta) => {
    const to = dayIdx + delta;
    if (to < 0 || to >= trip.days.length) return;
    actions.reorderDays(moveItem(trip.days, dayIdx, to).map((d) => d.id));
    patch({ day: to, focusIdx: -1 });
    setUndo(null); setEditId(null); setConfirmDay(false);
  };

  const removeDay = () => {
    actions.removeDay(day.id);
    patch({ day: Math.max(0, dayIdx - 1), focusIdx: -1 });
    setUndo(null); setEditId(null); setConfirmDay(false);
  };

  const addStop = () => {
    const s = newStop();
    writeItems(day.id, [...day.items, s]);
    setEditId(s.id);
  };

  const saveStop = (stop) => {
    writeItems(day.id, day.items.map((s) => (s.id === stop.id ? stop : s)));
    setEditId(null);
  };

  const removeStop = (id) => {
    writeItems(day.id, day.items.filter((s) => s.id !== id));
    setEditId(null);
    patch({ focusIdx: -1 });
  };

  const outOfOrder = day ? isOutOfOrder(day.items) : false;
  /* Straight-line, not driving distance — but a real number in kilometres,
     which is what makes "Tối ưu tuyến đường" checkable by eye. */
  const routeKm = day ? routeLengthKm(day.items) : 0;

  return (
    <div className="st-2col">
      <section aria-label="Lịch trình theo ngày">
        {editable && (
          <div className="st-datefields">
            <label className="field">
              <span>Ngày đi</span>
              <input className="input" type="date" value={trip.startDate ?? ''}
                onChange={(e) => actions.updateTrip({ startDate: e.target.value || null })} />
            </label>
            <label className="field">
              <span>Ngày về</span>
              <input className="input" type="date" value={trip.endDate ?? ''} min={trip.startDate ?? undefined}
                onChange={(e) => actions.updateTrip({ endDate: e.target.value || null })} />
            </label>
          </div>
        )}

        <div className="st-dayhead">
          {trip.days.length > 0 && (
            <Seg ariaLabel="Chọn ngày" options={trip.days.map((d, i) => ({
              key: d.id, label: `Ngày ${i + 1}`, active: i === dayIdx, onClick: () => selectDay(i),
            }))} />
          )}
          {editable && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={addDay}>
              <Plus width="15" height="15" />Thêm ngày
            </button>
          )}
          {editable && day && day.items.length > 2 && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }}
              onClick={() => reorder(optimizeRoute(day.items), 'tối ưu tuyến đường', true)}>
              <Route width="15" height="15" />Tối ưu tuyến đường
            </button>
          )}
        </div>

        {!day ? (
          <div className="st-empty">
            <h4>Chuyến đi chưa có ngày nào</h4>
            <p>Thêm ngày đầu tiên rồi bắt đầu ghi các điểm dừng cho hôm đó.</p>
            {editable && (
              <button type="button" className="btn btn-primary" onClick={addDay}>
                <Plus width="15" height="15" />Thêm ngày
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="st-daytitlerow">
              {editable ? (
                <input className="st-daytitle st-titlefield" {...place}
                  placeholder="Đặt tên cho ngày này" aria-label={`Tên ngày ${dayIdx + 1}`} />
              ) : (
                <h2 className="st-daytitle">{day.place || `Ngày ${dayIdx + 1}`}</h2>
              )}
              {editable && trip.days.length > 1 && (
                <span className="st-stop-move st-daymove">
                  <button type="button" disabled={dayIdx === 0}
                    aria-label={`Chuyển ngày ${dayIdx + 1} lên trước`}
                    onClick={() => moveDay(-1)}>
                    <ChevronUp width="15" height="15" />
                  </button>
                  <button type="button" disabled={dayIdx === trip.days.length - 1}
                    aria-label={`Chuyển ngày ${dayIdx + 1} xuống sau`}
                    onClick={() => moveDay(1)}>
                    <ChevronDown width="15" height="15" />
                  </button>
                </span>
              )}
              {editable && (confirmDay ? (
                <span className="st-confirm">
                  <button type="button" className="btn btn-ghost st-danger" onClick={removeDay}>Xoá cả ngày?</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmDay(false)}>Giữ lại</button>
                </span>
              ) : (
                <button type="button" className="btn btn-ghost st-danger" style={{ fontSize: 13 }}
                  onClick={() => setConfirmDay(true)}>Xoá ngày</button>
              ))}
            </div>
            <p className="st-daysub">
              {dayLabel(trip.startDate, dayIdx)} · {day.items.length} điểm dừng · dự chi {fmt(daySpend)}
              {routeKm >= 0.1 && ` · quãng đường ${routeKm < 10 ? routeKm.toFixed(1) : Math.round(routeKm)} km`}
              {day.items.length > 0 && ' — chạm để định vị trên bản đồ'}
              {day.items.length > 0 && editable && ', dùng nút ↑ ↓ hoặc kéo để đổi thứ tự'}
            </p>

            {undo && (
              <div className="st-undo" role="status">
                <span>Đã {undo.label}.</span>
                <button type="button" className="btn btn-ghost" onClick={applyUndo}>Hoàn tác</button>
              </div>
            )}

            {outOfOrder && editable && (
              <div className="st-hint" role="status">
                <span>Thứ tự hiện tại không khớp với giờ đã ghi.</span>
                <button type="button" className="btn btn-ghost"
                  onClick={() => reorder(byTime(day.items), 'sắp lại theo giờ', true)}>
                  Sắp lại theo giờ
                </button>
              </div>
            )}

            {day.items.length === 0 ? (
              <div className="st-empty">
                <h4>Ngày này chưa có điểm dừng</h4>
                <p>Thêm điểm dừng đầu tiên để bắt đầu dựng lịch trình cho hôm đó.</p>
                {editable && (
                  <button type="button" className="btn btn-primary" onClick={addStop}>
                    <Plus width="15" height="15" />Thêm điểm dừng
                  </button>
                )}
              </div>
            ) : (
              <ol className="st-stops st-stagger" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {day.items.map((it, i) => (
                  <li key={it.id}>
                    {editId === it.id ? (
                      <StopEditor stop={it} onSave={saveStop} onRemove={() => removeStop(it.id)} />
                    ) : (
                      /* The row itself is not a control: it holds three of
                         them, and a button inside a button is not reachable by
                         keyboard or announced correctly. Clicking the row still
                         locates the stop for pointer users; the number badge is
                         the same action, reachable by Tab. */
                      <div
                        className={[
                          'st-stop',
                          state.focusIdx === i ? 'active' : '',
                          dragIdx === i ? 'dragging' : '',
                          overIdx === i && dragIdx !== i ? 'drag-over' : '',
                        ].join(' ')}
                        draggable={editable}
                        onDragStart={() => setDragIdx(i)}
                        onDragEnd={() => { setDragIdx(-1); setOverIdx(-1); }}
                        onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                        onDrop={(e) => { e.preventDefault(); onDrop(i); setDragIdx(-1); setOverIdx(-1); }}
                        onClick={() => patch({ focusIdx: i })}>
                        {editable && <Grip className="st-grip" />}
                        <button type="button" className="st-stop-num"
                          aria-label={`Xem ${it.name || 'điểm dừng'} trên bản đồ`}
                          aria-pressed={state.focusIdx === i}
                          onClick={(e) => { e.stopPropagation(); patch({ focusIdx: i }); }}>
                          {i + 1}
                        </button>
                        <span className="st-stop-time">{it.time}</span>
                        <span>
                          <span className="st-stop-name">{it.name || 'Điểm dừng chưa đặt tên'}</span>
                          <span className="st-stop-note">{it.note}</span>
                        </span>
                        <span className={`st-stop-cost ${it.cost ? '' : 'free'}`}>
                          {it.cost ? fmt(it.cost) : 'Miễn phí'}
                        </span>
                        {editable ? (
                          <span className="st-stop-move">
                            <button type="button" disabled={i === 0}
                              aria-label={`Chuyển ${it.name || 'điểm dừng'} lên trên`}
                              onClick={(e) => { e.stopPropagation(); nudge(i, -1); }}>
                              <ChevronUp width="15" height="15" />
                            </button>
                            <button type="button" disabled={i === day.items.length - 1}
                              aria-label={`Chuyển ${it.name || 'điểm dừng'} xuống dưới`}
                              onClick={(e) => { e.stopPropagation(); nudge(i, 1); }}>
                              <ChevronDown width="15" height="15" />
                            </button>
                          </span>
                        ) : <span />}
                        {editable ? (
                          <button type="button" className="st-stop-edit"
                            aria-label={`Sửa ${it.name || 'điểm dừng'}`}
                            onClick={(e) => { e.stopPropagation(); setEditId(it.id); }}>
                            Sửa
                          </button>
                        ) : <span />}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {editable && day.items.length > 0 && (
              <button type="button" className="btn btn-secondary" style={{ marginTop: 18 }} onClick={addStop}>
                <Plus width="15" height="15" />Thêm điểm dừng
              </button>
            )}
          </>
        )}
      </section>

      <figure className="st-mapfig">
        <Suspense fallback={<div className="st-mapwrap" style={{ height: 580 }} />}>
          <MapView stops={day?.items ?? []} focusIdx={state.focusIdx} style={{ height: 580 }} />
        </Suspense>
        <figcaption style={{ marginTop: 10, fontSize: 12 }}>
          Bản đồ © OpenStreetMap · ghim đang chọn đổi sang màu rêu
          <En> · tap a stop to locate it</En>
        </figcaption>
      </figure>
    </div>
  );
}
