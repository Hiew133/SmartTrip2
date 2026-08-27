import { useApp, useActiveTrip, useTripRole, canEdit, computeBudget } from '../store.jsx';
import { STATUS_LABEL, fmt, formatRange, photo, stopCount, tripStatus } from '../data.js';
import { Avatar, ChevronLeft, Photo, Users } from '../components/ui.jsx';
import { useFieldDraft } from '../components/useFieldDraft.js';
import ItineraryTab from './trip/ItineraryTab.jsx';
import BudgetTab from './trip/BudgetTab.jsx';
import MembersTab from './trip/MembersTab.jsx';

const TABS = [
  ['itin', 'Lịch trình & bản đồ'],
  ['budget', 'Ngân sách & chia tiền'],
  ['members', 'Thành viên'],
];

export default function Trip() {
  const { state, patch, go, actions } = useApp();
  const trip = useActiveTrip();
  const role = useTripRole(trip);
  const editable = canEdit(role);
  const title = useFieldDraft(trip?.title, (v) => actions.updateTrip({ title: v }));

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

  return (
    <div className="st-page" style={{ paddingTop: 24 }}>
      <button type="button" className="btn btn-ghost" style={{ marginLeft: -10 }} onClick={() => go('trips')}>
        <ChevronLeft width="15" height="15" />Tất cả chuyến đi
      </button>

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
        {TABS.map(([key, label]) => (
          <button key={key} type="button"
            className={`st-tab ${state.tripTab === key ? 'active' : ''}`}
            aria-current={state.tripTab === key ? 'true' : undefined}
            onClick={() => patch({ tripTab: key })}>
            {label}
          </button>
        ))}
      </nav>

      {state.tripTab === 'itin' && <ItineraryTab trip={trip} editable={editable} />}
      {state.tripTab === 'budget' && <BudgetTab trip={trip} editable={editable} />}
      {state.tripTab === 'members' && <MembersTab trip={trip} role={role} />}
    </div>
  );
}
