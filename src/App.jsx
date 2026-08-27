import { useEffect, useState } from 'react';
import { useApp } from './store.jsx';
import { Avatar, Pin } from './components/ui.jsx';
import Login from './screens/Login.jsx';
import Trips from './screens/Trips.jsx';
import Trip from './screens/Trip.jsx';
import AIDesk from './screens/AIDesk.jsx';
import Mobile from './screens/Mobile.jsx';
import ExpenseDialog from './components/ExpenseDialog.jsx';

const NAV = [
  ['Chuyến đi', 'trips', (s) => s === 'trips' || s === 'trip'],
  ['Trợ lý AI', 'ai', (s) => s === 'ai'],
  ['Bản mobile', 'mobile', (s) => s === 'mobile'],
];

function TopBar() {
  const { state, patch, go } = useApp();
  return (
    <header className="st-topbar">
      <nav className="st-nav" aria-label="Điều hướng chính">
        <button type="button" className="st-brand" onClick={() => go('trips')}>
          <Pin width="21" height="21" />SmartTrip
        </button>
        <div className="st-navlinks">
          {NAV.map(([label, screen, isActive]) => (
            <button key={screen} type="button"
              className={`st-navlink ${isActive(state.screen) ? 'active' : ''}`}
              aria-current={isActive(state.screen) ? 'page' : undefined}
              onClick={() => go(screen)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="st-lang" aria-pressed={state.showEnglish}
          title="Hiện hoặc ẩn phụ đề tiếng Anh"
          onClick={() => patch((s) => ({ showEnglish: !s.showEnglish }))}>
          <span className="st-lang-dot" />EN
        </button>
        <span className="st-navmeta">
          <Avatar initial="M" size={32} />
          <span className="st-navname">Minh</span>
        </span>
        <button type="button" className="btn btn-ghost" onClick={() => go('login')}>Đăng xuất</button>
      </nav>
    </header>
  );
}

export default function App() {
  const { state } = useApp();
  const inApp = state.screen !== 'login';

  /* Entry animations are decoration; this guarantees the view ends up visible
     even if they never get to run (background tab, throttling). */
  const view = `${state.screen}:${state.tripTab}:${state.aiPhase}`;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 1100);
    return () => clearTimeout(t);
  }, [view]);

  return (
    <div className={`st-app ${settled ? 'st-settled' : ''}`} data-en={state.showEnglish ? 'on' : 'off'}>
      <div className="st-grain" aria-hidden="true" />
      {inApp && <a className="st-skip" href="#main">Bỏ qua, tới nội dung chính</a>}
      {inApp && <TopBar />}
      <main id="main">
        {state.screen === 'login' && <Login />}
        {state.screen === 'trips' && <Trips />}
        {state.screen === 'trip' && <Trip />}
        {state.screen === 'ai' && <AIDesk />}
        {state.screen === 'mobile' && <Mobile />}
      </main>
      {state.showAdd && <ExpenseDialog />}
    </div>
  );
}
