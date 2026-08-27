import { useApp } from '../store.jsx';
import {
  STATUS_LABEL, daysUntil, fmt, formatRange, newTrip, photo, stopCount, tripStatus, tripTotal,
} from '../data.js';
import { Compass, Photo, Plus, muted } from '../components/ui.jsx';

/* Every number on a card is derived from the trip itself. The old hard-coded
   strings ("15 điểm dừng", "14.910.000 ₫") drifted the moment anyone edited
   anything, and quietly lied on every trip but the demo one. */
function spendLine(trip, status) {
  const total = tripTotal(trip);
  if (status === 'past') return `Đã chi ${fmt(total)}`;
  if (!trip.plan) return total > 0 ? `Đã ghi ${fmt(total)}` : 'Chưa lập ngân sách';
  return `${fmt(total)} / ${fmt(trip.plan)}`;
}

function TripCard({ trip, featured, onOpen }) {
  const status = tripStatus(trip);
  const tag = STATUS_LABEL[status];
  const stops = stopCount(trip);

  return (
    <article className={`st-trip ${featured ? 'st-trip-feature' : ''}`} role="button" tabIndex={0}
      aria-label={`Mở chuyến đi ${trip.title}`}
      onClick={onOpen} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}>
      <Photo className="st-trip-media" src={photo(trip.seed, featured ? 1000 : 800, featured ? 900 : 560)}
        alt={trip.alt}>
        <div className="st-plate-cap">
          <span className="tag" style={{ background: 'rgba(255,255,255,.9)', color: 'var(--color-accent-900)' }}>
            {tag.label}
          </span>
        </div>
      </Photo>
      <div className="st-trip-body">
        <span className="card-kicker">{formatRange(trip.startDate, trip.endDate)}</span>
        <h3 className="st-trip-title">{trip.title}</h3>
        <p className="st-trip-desc">{trip.body}</p>
        <div className="st-trip-foot">
          <span style={{ fontSize: 12.5, fontWeight: 600, color: muted(56) }}>
            {stops > 0 ? `${stops} điểm dừng` : 'Chưa có điểm dừng'} · {trip.members.length} người
          </span>
          <span className="st-trip-spend">{spendLine(trip, status)}</span>
        </div>
      </div>
    </article>
  );
}

/** "khởi hành sau 16 ngày nữa" — recomputed on every render, never stored. */
function leadLine(trips) {
  const soon = trips
    .map((t) => ({ t, d: daysUntil(t.startDate) }))
    .filter(({ d }) => d !== null && d >= 0)
    .sort((a, b) => a.d - b.d)[0];
  if (!soon) return 'Chưa có chuyến nào đặt ngày khởi hành.';
  const when = soon.d === 0 ? 'khởi hành hôm nay' : soon.d === 1 ? 'khởi hành ngày mai' : `khởi hành sau ${soon.d} ngày nữa`;
  return `${trips.length} chuyến đang mở. ${soon.t.title} ${when}.`;
}

export default function Trips() {
  const { state, patch, go } = useApp();
  const { trips } = state;

  const open = (id) => go('trip', { activeTripId: id, tripTab: 'itin', day: 0, focusIdx: -1, mDay: 0, mFocus: -1 });

  const createEmpty = () => {
    const trip = newTrip();
    patch((s) => ({ trips: [...s.trips, trip] }));
    open(trip.id);
  };

  const upcoming = trips.filter((t) => tripStatus(t) === 'upcoming');
  const openBudget = trips.filter((t) => tripStatus(t) !== 'past' && tripTotal(t) < t.plan).length;
  const totalStops = trips.reduce((s, t) => s + stopCount(t), 0);

  return (
    <div className="st-page">
      <header className="st-head st-rise">
        <div>
          <span className="st-eyebrow">Sổ chuyến đi<span className="st-en">&nbsp;· My trips</span></span>
          <h1 className="st-display">Chuyến đi của tôi</h1>
          <p className="st-lede" style={{ margin: '14px 0 0' }}>{leadLine(trips)}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={createEmpty}>
            <Plus width="15" height="15" />Chuyến trống
          </button>
          <button type="button" className="btn btn-primary" onClick={() => go('ai')}>
            <Compass width="15" height="15" />Soạn chuyến mới với AI
          </button>
        </div>
      </header>

      <div className="st-metarow" style={{ margin: '26px 0 30px' }}>
        {upcoming[0] && <span className="tag tag-accent">Sắp tới · {upcoming[0].title}</span>}
        <span className="tag tag-neutral">{totalStops} điểm dừng đã lên lịch</span>
        {openBudget > 0 && (
          <span className="tag tag-neutral">
            {openBudget} chuyến còn mở ngân sách
          </span>
        )}
      </div>

      <section className="st-trips st-stagger" aria-label="Danh sách chuyến đi">
        {trips.map((t, i) => (
          <TripCard key={t.id} trip={t} featured={i === 0} onOpen={() => open(t.id)} />
        ))}
      </section>
    </div>
  );
}
