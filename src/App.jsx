import { useEffect, useState } from 'react';
import { useActiveTrip, useApp } from './store.jsx';
import { signOutUser } from './backend/index.js';
import { Avatar, Pin } from './components/ui.jsx';
import Login from './screens/Login.jsx';
import Trips from './screens/Trips.jsx';
import Trip from './screens/Trip.jsx';
import AIDesk from './screens/AIDesk.jsx';
import Profile from './screens/Profile.jsx';
import ExpenseDialog from './components/ExpenseDialog.jsx';
import TripPrintSheet from './components/TripPrintSheet.jsx';
import Toast from './components/Toast.jsx';

const NAV = [
  ['Chuyến đi', 'trips', (s) => s === 'trips' || s === 'trip'],
  ['Trợ lý AI', 'ai', (s) => s === 'ai'],
];

function TopBar() {
  const { state, patch, go } = useApp();
  const me = state.user;
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
        {/* the way into the profile screen: verification, sign-in method, sign out */}
        <button type="button" className="st-navmeta" onClick={() => go('profile')}
          aria-current={state.screen === 'profile' ? 'page' : undefined}
          title={me?.email} aria-label={`Trang cá nhân của ${me?.name || 'bạn'}`}>
          <Avatar initial={(me?.name || '?')[0].toUpperCase()} size={32} />
          <span className="st-navname">{me?.name || 'Bạn'}</span>
          {me && !me.emailVerified && <span className="st-navdot" aria-hidden="true" />}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => signOutUser()}>Đăng xuất</button>
      </nav>
    </header>
  );
}

export default function App() {
  const { state } = useApp();
  const printable = useActiveTrip();
  const inApp = state.screen !== 'login' && !!state.user;

  /* Entry animations are decoration; this guarantees the view ends up visible
     even if they never get to run (background tab, throttling). */
  const view = `${state.screen}:${state.tripTab}:${state.aiPhase}`;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 1100);
    return () => clearTimeout(t);
  }, [view]);

  /* Reveal-on-scroll: elements tagged .st-reveal slide in once as they enter
     the viewport. Runs after each view change so new screens get observed. */
  useEffect(() => {
    const els = document.querySelectorAll('.st-reveal:not(.in)');
    if (!els.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [view]);

  return (
    <div className={`st-app ${settled ? 'st-settled' : ''}`} data-en={state.showEnglish ? 'on' : 'off'}>
      <div className="st-grain" aria-hidden="true" />
      {inApp && <a className="st-skip" href="#main">Bỏ qua, tới nội dung chính</a>}
      {inApp && <TopBar />}
      <main id="main">
        {/* Auth resolves asynchronously; flashing the login form at someone who
            is already signed in reads as being logged out. */}
        {!state.authReady ? (
          <div className="st-boot" role="status" aria-label="Đang mở SmartTrip">
            <Pin width="30" height="30" />
            <span>Đang mở SmartTrip…</span>
          </div>
        ) : !state.user ? <Login /> : (
          <>
            {state.screen === 'trips' && <Trips />}
            {state.screen === 'trip' && <Trip />}
            {state.screen === 'ai' && <AIDesk />}
            {state.screen === 'profile' && <Profile />}
          </>
        )}
      </main>
      {state.showAdd && <ExpenseDialog />}
      {/* Outside <main> on purpose: printing hides #main and shows this
          instead, so it cannot live inside the screen it replaces. */}
      {state.screen === 'trip' && <TripPrintSheet trip={printable} />}
      <Toast />
    </div>
  );
}
