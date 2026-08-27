import { useState } from 'react';
import { useApp } from '../../store.jsx';
import { fmt } from '../../data.js';
import { Grip, Route, Seg } from '../../components/ui.jsx';
import MapView from '../../components/MapView.jsx';

/* Nearest-neighbour reorder: keep the first stop, then always hop to the
   closest remaining one. Times stay in their original slots. */
function optimizeRoute(items) {
  if (items.length < 3) return items;
  const left = items.slice(1);
  const route = [items[0]];
  while (left.length) {
    const cur = route[route.length - 1];
    let best = 0, bestD = Infinity;
    left.forEach((s, i) => {
      const d = (s.lat - cur.lat) ** 2 + (s.lng - cur.lng) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    route.push(left.splice(best, 1)[0]);
  }
  const times = items.map((s) => s.t);
  return route.map((s, i) => ({ ...s, t: times[i] }));
}

export default function ItineraryTab() {
  const { state, patch } = useApp();
  const [dragIdx, setDragIdx] = useState(-1);
  const [overIdx, setOverIdx] = useState(-1);

  const day = state.days[state.day];
  const daySpend = day.items.reduce((s, i) => s + i.c, 0);

  const setItems = (items) => patch((s) => ({
    days: s.days.map((d, i) => (i === s.day ? { ...d, items } : d)),
    focusIdx: -1,
  }));

  const onDrop = (to) => {
    if (dragIdx < 0 || dragIdx === to) return;
    const items = day.items.slice();
    const times = items.map((s) => s.t);
    const [moved] = items.splice(dragIdx, 1);
    items.splice(to, 0, moved);
    setItems(items.map((s, i) => ({ ...s, t: times[i] })));
  };

  return (
    <div className="st-2col">
      <section aria-label="Lịch trình theo ngày">
        <div className="st-dayhead">
          <Seg ariaLabel="Chọn ngày" options={state.days.map((d, i) => ({
            label: `Ngày ${i + 1}`, active: i === state.day,
            onClick: () => patch({ day: i, focusIdx: -1 }),
          }))} />
          <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }}
            onClick={() => setItems(optimizeRoute(day.items))}>
            <Route width="15" height="15" />Tối ưu tuyến đường
          </button>
        </div>

        <h2 className="st-daytitle">{day.place}</h2>
        <p className="st-daysub">
          {day.dow} · {day.items.length} điểm dừng · dự chi {fmt(daySpend)} — chạm để định vị trên bản đồ,
          kéo để đổi thứ tự
        </p>

        <ol className="st-stops st-stagger" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {day.items.map((it, i) => (
            <li key={`${it.n}-${i}`}>
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
                role="button" tabIndex={0} aria-label={`Xem ${it.n} trên bản đồ`}
                aria-pressed={state.focusIdx === i}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), patch({ focusIdx: i }))}
                onClick={() => patch({ focusIdx: i })}>
                <Grip className="st-grip" />
                <span className="st-stop-num">{i + 1}</span>
                <span className="st-stop-time">{it.t}</span>
                <span>
                  <span className="st-stop-name">{it.n}</span>
                  <span className="st-stop-note">{it.note}</span>
                </span>
                <span className={`st-stop-cost ${it.c ? '' : 'free'}`}>
                  {it.c ? fmt(it.c) : 'Miễn phí'}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <figure className="st-mapfig">
        <MapView stops={day.items} focusIdx={state.focusIdx} style={{ height: 580 }} />
        <figcaption style={{ marginTop: 10, fontSize: 12 }}>
          Bản đồ © OpenStreetMap · ghim đang chọn đổi sang màu rêu
          <span className="st-en"> · tap a stop to locate it</span>
        </figcaption>
      </figure>
    </div>
  );
}
