import { useApp } from '../store.jsx';
import { TRIP_CARDS, photo } from '../data.js';
import { Compass, Photo, Plus, muted } from '../components/ui.jsx';

function TripCard({ trip, featured, onOpen }) {
  return (
    <article className={`st-trip ${featured ? 'st-trip-feature' : ''}`} role="button" tabIndex={0}
      aria-label={`Mở chuyến đi ${trip.title}`}
      onClick={onOpen} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}>
      <Photo className="st-trip-media" src={photo(trip.seed, featured ? 1000 : 800, featured ? 900 : 560)}
        alt={trip.alt}>
        <div className="st-plate-cap">
          <span className="tag" style={{ background: 'rgba(255,255,255,.9)', color: 'var(--color-accent-900)' }}>
            {trip.tag}
          </span>
        </div>
      </Photo>
      <div className="st-trip-body">
        <span className="card-kicker">{trip.dates}</span>
        <h3 className="st-trip-title">{trip.title}</h3>
        <p className="st-trip-desc">{trip.body}</p>
        <div className="st-trip-foot">
          <span style={{ fontSize: 12.5, fontWeight: 600, color: muted(56) }}>
            {trip.stops > 0 ? `${trip.stops} điểm dừng` : 'Chưa có điểm dừng'} · {trip.people} người
          </span>
          <span className="st-trip-spend">{trip.spend}</span>
        </div>
      </div>
    </article>
  );
}

export default function Trips() {
  const { go } = useApp();
  const openTrip = () => go('trip', { tripTab: 'itin' });

  return (
    <div className="st-page">
      <header className="st-head st-rise">
        <div>
          <span className="st-eyebrow">Sổ chuyến đi<span className="st-en">&nbsp;· My trips</span></span>
          <h1 className="st-display">Chuyến đi của tôi</h1>
          <p className="st-lede" style={{ margin: '14px 0 0' }}>
            Ba chuyến đang mở. Chuyến gần nhất khởi hành sau 16 ngày nữa.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={openTrip}>
            <Plus width="15" height="15" />Chuyến trống
          </button>
          <button type="button" className="btn btn-primary" onClick={() => go('ai')}>
            <Compass width="15" height="15" />Soạn chuyến mới với AI
          </button>
        </div>
      </header>

      <div className="st-metarow" style={{ margin: '26px 0 30px' }}>
        <span className="tag tag-accent">Sắp tới · Đà Nẵng – Hội An</span>
        <span className="tag tag-neutral">37 điểm dừng đã lên lịch</span>
        <span className="tag tag-neutral">2 chuyến còn mở ngân sách</span>
      </div>

      <section className="st-trips st-stagger" aria-label="Danh sách chuyến đi">
        {TRIP_CARDS.map((t, i) => (
          <TripCard key={t.id} trip={t} featured={i === 0} onOpen={openTrip} />
        ))}
      </section>
    </div>
  );
}
