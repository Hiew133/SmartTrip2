import { useState } from 'react';
import { useApp, useActiveTrip, useTripRole, canEdit } from '../store.jsx';
import { computeBudget } from '../budget.js';
import { STATUS_LABEL, fmt, formatRange, photo, stopCount, tripStatus } from '../data.js';
import { Avatar, ChevronLeft, Photo, Printer, Users } from '../components/ui.jsx';
import { useFieldDraft } from '../components/useFieldDraft.js';
import ItineraryTab from './trip/ItineraryTab.jsx';
import BudgetTab from './trip/BudgetTab.jsx';
import MembersTab from './trip/MembersTab.jsx';
import GuideTab from './trip/GuideTab.jsx';
import AssistantTab from './trip/AssistantTab.jsx';

/* `edit` marks a tab that only exists for people who can change the trip. The
   assistant is one: everything it offers ends in a write, so showing it to a
   viewer would be a screen full of buttons that all fail. */
const TABS = [
  ['itin', 'Lịch trình & bản đồ'],
  ['assist', 'Trợ lý AI', 'edit'],
  ['budget', 'Ngân sách & chia tiền'],
  ['members', 'Thành viên'],
  ['guide', 'Cẩm nang bản địa'],
];

export default function Trip() {
  const { state, patch, go, actions } = useApp();
  const trip = useActiveTrip();
  const role = useTripRole(trip);
  const editable = canEdit(role);
  const title = useFieldDraft(trip?.title, (v) => actions.updateTrip({ title: v }));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* Only the owner may delete — the rules say so too, so a viewer or editor
     pressing this would just collect a permission error. On success the store
     moves to the trip list and this screen unmounts; on failure the toast
     explains and the trip stays where it was. */
  const removeTrip = async () => {
    setDeleting(true);
    const ok = await actions.deleteTrip();
    if (!ok) { setDeleting(false); setConfirmDelete(false); }
  };

  if (!trip) {
    return (
      <div className="st-page" style={{ paddingTop: 24 }}>
        <div className="st-empty">
          <h4>Chưa chọn chuyến đi</h4>
          <p>Quay lại danh sách để mở một chuyến đi.</p>
          <button type="button" className="btn btn-primary" onClick={() => go('trips')}>
            Tất cả chuyến đi
          </button>
        </div>
      </div>
    );
  }

  const { core, total } = computeBudget(trip);
  const stops = stopCount(trip);
  const status = tripStatus(trip);

  /* tripTab is remembered across trips, and a viewer can land on a trip while
     it still says "assist" from an editable one — fall back rather than render
     a blank page under a tab strip that no longer has that tab. */
  const tabs = TABS.filter(([, , needs]) => needs !== 'edit' || editable);
  const tab = tabs.some(([key]) => key === state.tripTab) ? state.tripTab : 'itin';

  return (
    <div className="st-page" style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost" style={{ marginLeft: -10 }} onClick={() => go('trips')}>
          <ChevronLeft width="15" height="15" />Tất cả chuyến đi
        </button>
        <span style={{ flex: 1 }} />
        {/* No library and no server: the browser's own print dialog offers
            "Save as PDF", and TripPrintSheet is what it lays out. Everyone
            gets this, including people who can only view the trip. */}
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }}
          onClick={() => window.print()}>
          <Printer width="15" height="15" />Xuất PDF
        </button>
        {role === 'owner' && !confirmDelete && (
          <button type="button" className="btn btn-ghost st-danger" style={{ fontSize: 13 }}
            onClick={() => setConfirmDelete(true)}>
            Xoá chuyến đi
          </button>
        )}
      </div>

      {/* a whole trip is a lot to lose on a mis-click, so the confirmation
          names what goes with it rather than just asking "are you sure?" */}
      {role === 'owner' && confirmDelete && (
        <div className="st-hint" role="alert" style={{ marginTop: 12 }}>
          <span>
            Xoá <b>{trip.title}</b> là mất toàn bộ lịch trình, khoản chi và danh sách
            thành viên của chuyến này. Không hoàn tác được.
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost st-danger" onClick={removeTrip} disabled={deleting}>
            {deleting ? 'Đang xoá…' : 'Xoá hẳn'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
            Giữ lại
          </button>
        </div>
      )}

      <header className="st-hero st-rise st-reveal">
        <Photo src={photo(trip.seed, 1800, 800)} alt={trip.alt} />
        <div className="st-hero-body">
          <div>
            {editable ? (
              <input className="st-hero-title st-titlefield" {...title}
                aria-label="Tên chuyến đi" placeholder="Đặt tên cho chuyến đi" />
            ) : (
              <h1 className="st-hero-title">{trip.title}</h1>
            )}
            <div className="st-metarow">
              <span className={`tag ${STATUS_LABEL[status].cls}`}>{STATUS_LABEL[status].label}</span>
              <span className="tag tag-accent">{formatRange(trip.startDate, trip.endDate)}</span>
              <span className="tag">{core.length} thành viên</span>
              <span className="tag">{stops} điểm dừng</span>
              <span className="tag">Đã ghi {fmt(total)}</span>
              {!editable && <span className="tag">Chỉ xem</span>}
            </div>
          </div>
          <div className="st-hero-actions">
            <div className="st-avatars">
              {core.map((m, i) => (
                <Avatar key={m.id} initial={m.name[0]} tone={i % 2} ring />
              ))}
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => patch({ tripTab: 'members' })}>
              <Users width="15" height="15" />Mời bạn đồng hành
            </button>
          </div>
        </div>
      </header>

      <nav className="st-tabs" aria-label="Khu vực của chuyến đi">
        {tabs.map(([key, label]) => (
          <button key={key} type="button"
            className={`st-tab ${tab === key ? 'active' : ''}`}
            aria-current={tab === key ? 'true' : undefined}
            onClick={() => patch({ tripTab: key })}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'itin' && <ItineraryTab trip={trip} editable={editable} />}
      {tab === 'assist' && <AssistantTab trip={trip} />}
      {tab === 'budget' && <BudgetTab trip={trip} editable={editable} />}
      {tab === 'members' && <MembersTab trip={trip} role={role} />}
      {tab === 'guide' && <GuideTab trip={trip} editable={editable} />}
    </div>
  );
}
