import { computeBudget } from '../budget.js';
import { dayLabel, fmt, formatRange, stopCount } from '../data.js';
import { routeLengthKm } from '../itinerary.js';

/* The printable version of a trip — "Xuất PDF" is the browser's own
   Print → Save as PDF, so this needs no library and no server.

   It exists as a separate component rather than as print styles over the app
   because the screen only ever renders one day at a time: styling that would
   have produced a one-day PDF and called it the itinerary. Here every day is
   laid out at once, the map and every control are gone, and the money summary
   comes along — which is the part people actually want on paper at the end.

   Hidden on screen (see .st-print), shown only inside @media print. */
export default function TripPrintSheet({ trip }) {
  if (!trip) return null;
  const { core, total, share, bal, transfers } = computeBudget(trip);

  return (
    <article className="st-print" aria-hidden="true">
      <header className="st-print-head">
        <h1>{trip.title}</h1>
        <p className="st-print-meta">
          {formatRange(trip.startDate, trip.endDate)}
          {' · '}{core.length} người
          {' · '}{stopCount(trip)} điểm dừng
        </p>
        {trip.body && <p className="st-print-body">{trip.body}</p>}
        <p className="st-print-meta">
          Cùng đi: {core.map((m) => m.name).join(', ') || '—'}
        </p>
      </header>

      {trip.days.length === 0 ? (
        <p className="st-print-meta">Chuyến đi chưa có ngày nào.</p>
      ) : trip.days.map((d, i) => {
        const spend = d.items.reduce((s, it) => s + it.cost, 0);
        const km = routeLengthKm(d.items);
        return (
          <section key={d.id} className="st-print-day">
            <h2>
              Ngày {i + 1}
              {d.place ? ` — ${d.place}` : ''}
              <span className="st-print-daymeta">
                {dayLabel(trip.startDate, i)}
                {' · '}dự chi {fmt(spend)}
                {km >= 0.1 && ` · ${km < 10 ? km.toFixed(1) : Math.round(km)} km`}
              </span>
            </h2>
            {d.items.length === 0 ? (
              <p className="st-print-meta">Chưa có điểm dừng.</p>
            ) : (
              <table className="st-print-table">
                <tbody>
                  {d.items.map((it) => (
                    <tr key={it.id}>
                      <td className="st-print-time">{it.time}</td>
                      <td>
                        <b>{it.name || 'Điểm dừng chưa đặt tên'}</b>
                        {it.note && <div className="st-print-note">{it.note}</div>}
                      </td>
                      <td className="st-print-cost">{it.cost ? fmt(it.cost) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}

      <section className="st-print-day">
        <h2>Ngân sách<span className="st-print-daymeta">
          {trip.plan > 0 ? `kế hoạch ${fmt(trip.plan)} · ` : ''}đã ghi {fmt(total)}
          {core.length > 0 && ` · mỗi người ${fmt(share)}`}
        </span></h2>

        {trip.expenses.length === 0 ? (
          <p className="st-print-meta">Chưa ghi khoản chi nào.</p>
        ) : (
          <>
            <table className="st-print-table">
              <tbody>
                {trip.expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="st-print-time">{e.cat}</td>
                    <td>
                      <b>{e.name}</b>
                      <div className="st-print-note">
                        {trip.members.find((m) => m.id === e.payerId)?.name ?? '—'} ứng
                      </div>
                    </td>
                    <td className="st-print-cost">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>Số dư</h3>
            <ul className="st-print-list">
              {bal.map((b) => (
                <li key={b.id}>
                  {b.name}: {b.amt >= 0 ? `được nhận lại ${fmt(b.amt)}` : `còn nợ ${fmt(-b.amt)}`}
                </li>
              ))}
            </ul>

            {transfers.length > 0 && (
              <>
                <h3>Trả cho gọn</h3>
                <ul className="st-print-list">
                  {transfers.map((t) => (
                    <li key={`${t.fromId}>${t.toId}:${Math.round(t.a)}`}>
                      {t.from} → {t.to}: <b>{fmt(t.a)}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      <footer className="st-print-foot">
        In từ SmartTrip · {new Date().toLocaleDateString('vi-VN')}
      </footer>
    </article>
  );
}
