import { useApp, computeBudget } from '../store.jsx';
import { fmt, photo } from '../data.js';
import { Avatar, ChevronLeft, Photo, Users } from '../components/ui.jsx';
import ItineraryTab from './trip/ItineraryTab.jsx';
import BudgetTab from './trip/BudgetTab.jsx';
import MembersTab from './trip/MembersTab.jsx';

const TABS = [
  ['itin', 'Lịch trình & bản đồ'],
  ['budget', 'Ngân sách & chia tiền'],
  ['members', 'Thành viên'],
];

export default function Trip() {
  const { state, patch, go } = useApp();
  const { core, total } = computeBudget(state);
  const stopCount = state.days.reduce((s, d) => s + d.items.length, 0);

  return (
    <div className="st-page" style={{ paddingTop: 24 }}>
      <button type="button" className="btn btn-ghost" style={{ marginLeft: -10 }} onClick={() => go('trips')}>
        <ChevronLeft width="15" height="15" />Tất cả chuyến đi
      </button>

      <header className="st-hero st-rise st-reveal">
        <Photo src={photo('hoian-lanterns', 1800, 800)} alt="Phố cổ Hội An lên đèn bên sông Hoài" />
        <div className="st-hero-body">
          <div>
            <h1 className="st-hero-title">Đà Nẵng – Hội An</h1>
            <div className="st-metarow">
              <span className="tag tag-accent">12 – 15/09/2026</span>
              <span className="tag">{core.length} thành viên</span>
              <span className="tag">{stopCount} điểm dừng</span>
              <span className="tag">Đã ghi {fmt(total)}</span>
            </div>
          </div>
          <div className="st-hero-actions">
            <div className="st-avatars">
              {core.map((m, i) => (
                <Avatar key={m.e} initial={m.n[0]} tone={i % 2} ring />
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

      {state.tripTab === 'itin' && <ItineraryTab />}
      {state.tripTab === 'budget' && <BudgetTab />}
      {state.tripTab === 'members' && <MembersTab />}
    </div>
  );
}
