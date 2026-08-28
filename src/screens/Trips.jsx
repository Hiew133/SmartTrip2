import { useState } from 'react';
import { useApp, useTripsReady } from '../store.jsx';
import { firebaseEnabled, resendVerification } from '../backend/index.js';
import {
  SEED_TRIPS, STATUS_LABEL, daysUntil, fmt, formatRange, photo, stopCount, tripStatus, tripTotal,
} from '../data.js';
import { Compass, Photo, Plus, Search, muted } from '../components/ui.jsx';

const STATUS = ['Tất cả', 'Sắp tới', 'Nháp', 'Đã đi'];

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
    <article className={`st-trip ${featured ? 'st-trip-feature' : ''} st-reveal`} role="button" tabIndex={0}
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
  const stops = trips.reduce((s, t) => s + stopCount(t), 0);
  const head = `${trips.length} chuyến đang mở · ${stops} điểm dừng đã lên lịch.`;
  const soon = trips
    .map((t) => ({ t, d: daysUntil(t.startDate) }))
    .filter(({ d }) => d !== null && d >= 0)
    .sort((a, b) => a.d - b.d)[0];
  if (!soon) return `${head} Chưa có chuyến nào sắp khởi hành.`;
  const when = soon.d === 0 ? 'khởi hành hôm nay' : soon.d === 1 ? 'khởi hành ngày mai' : `khởi hành sau ${soon.d} ngày nữa`;
  return `${head} ${soon.t.title} ${when}.`;
}

export default function Trips() {
  const { state, go, actions } = useApp();
  const { trips } = state;
  const tripsReady = useTripsReady();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Tất cả');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');

  /* Without a verified address the rules will not let this account claim an
     invitation, and the query is skipped rather than failing every sign-in.
     Say so here, where it can actually be fixed. */
  const unverified = firebaseEnabled && state.user && !state.user.emailVerified;

  const resend = async () => {
    try {
      await resendVerification();
      setSent('Đã gửi lại. Kiểm tra hộp thư rồi đăng nhập lại.');
    } catch (err) {
      console.error('SmartTrip · gửi lại email xác minh:', err);
      setSent('Chưa gửi được. Thử lại sau một lát.');
    }
  };

  const open = (id) => go('trip', { activeTripId: id, tripTab: 'itin', day: 0, focusIdx: -1 });

  const createEmpty = async () => {
    setBusy(true);
    await actions.createTrip();
    setBusy(false);
  };

  /* First sign-in lands on an empty account. Copying the demo trips in is the
     fastest way to see what the app does without inventing a trip first. */
  const loadSamples = async () => {
    setBusy(true);
    for (const t of SEED_TRIPS) {
      await actions.createTrip({
        title: t.title, seed: t.seed, alt: t.alt, body: t.body,
        startDate: t.startDate, endDate: t.endDate, plan: t.plan,
        days: t.days, expenses: t.expenses, members: t.members, settled: {},
      }, { open: false });
    }
    setBusy(false);
  };

  const query = q.trim().toLowerCase();
  // filter against the derived status, so a trip changes bucket on its own
  const cards = trips.filter((t) => {
    const label = STATUS_LABEL[tripStatus(t)].label;
    const haystack = `${t.title} ${t.body} ${formatRange(t.startDate, t.endDate)}`.toLowerCase();
    return (status === 'Tất cả' || label === status) && (!query || haystack.includes(query));
  });

  return (
    <div className="st-page">
      <header className="st-head st-rise">
        <div>
          <span className="st-eyebrow">Sổ chuyến đi<span className="st-en">&nbsp;· My trips</span></span>
          <h1 className="st-display">Chuyến đi của tôi</h1>
          <p className="st-lede" style={{ margin: '14px 0 0' }}>{leadLine(trips)}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={createEmpty} disabled={busy}>
            <Plus width="15" height="15" />Chuyến trống
          </button>
          <button type="button" className="btn btn-primary" onClick={() => go('ai')}>
            <Compass width="15" height="15" />Soạn chuyến mới với AI
          </button>
        </div>
      </header>

      {state.dataError && <p className="st-error" style={{ marginTop: 20 }}>{state.dataError}</p>}

      {unverified && (
        <div className="st-hint" style={{ marginTop: 20 }} role="status">
          <span>
            Email <b>{state.user.email}</b> chưa xác minh — bạn sẽ không nhận được lời mời
            vào chuyến đi của người khác.
          </span>
          {sent
            ? <span className="text-muted">{sent}</span>
            : <button type="button" className="btn btn-ghost" onClick={resend}>Gửi lại email xác minh</button>}
        </div>
      )}

      <div className="st-toolbar st-reveal">
        <label className="st-search">
          <Search width="16" height="16" />
          <input className="input" value={q} placeholder="Tìm chuyến đi…" aria-label="Tìm chuyến đi"
            onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="st-metarow" role="group" aria-label="Lọc theo trạng thái">
          {STATUS.map((s) => (
            <button key={s} type="button" className={`st-chip ${status === s ? 'active' : ''}`}
              aria-pressed={status === s} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
      </div>

      {!tripsReady ? (
        <section className="st-trips" style={{ marginTop: 30 }} aria-busy="true" aria-label="Đang tải chuyến đi">
          {[0, 1, 2].map((i) => (
            <div key={i} className="st-skel" style={{ height: i === 0 ? 300 : 210, borderRadius: 28 }} />
          ))}
        </section>
      ) : trips.length === 0 ? (
        <div className="st-empty" style={{ marginTop: 30 }}>
          <h4>Chưa có chuyến đi nào</h4>
          <p>Bắt đầu bằng một chuyến trống, để AI soạn giúp, hoặc nạp ba chuyến mẫu để xem thử.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={createEmpty} disabled={busy}>
              <Plus width="15" height="15" />Chuyến trống
            </button>
            <button type="button" className="btn btn-secondary" onClick={loadSamples} disabled={busy}>
              {busy ? 'Đang nạp…' : 'Nạp 3 chuyến mẫu'}
            </button>
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="st-empty" style={{ marginTop: 30 }}>
          <h4>Không tìm thấy chuyến đi</h4>
          <p>Thử từ khoá khác hoặc chuyển bộ lọc sang "Tất cả".</p>
        </div>
      ) : (
        <section className="st-trips st-stagger" aria-label="Danh sách chuyến đi" style={{ marginTop: 30 }}>
          {cards.map((t, i) => (
            <TripCard key={t.id} trip={t} featured={i === 0} onOpen={() => open(t.id)} />
          ))}
        </section>
      )}
    </div>
  );
}
