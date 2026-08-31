import { useState } from 'react';
import { useApp } from '../store.jsx';
import {
  firebaseEnabled, resendVerification, signOutUser, verifyDemoEmail,
} from '../backend/index.js';
import { Avatar, Check, ChevronLeft, En } from '../components/ui.jsx';

/* The verification flow lives here rather than in a banner on the trip list.
   An account that signed in with Google has nothing to do on this screen but
   read it; an account created with email and password cannot be invited into
   anyone's trip until it confirms the address, because the security rules
   check `email_verified` before letting it claim a seat. */

const PROVIDER = {
  'google.com': 'Đăng nhập bằng Google',
  password: 'Email và mật khẩu',
};

export default function Profile() {
  const { state, go, actions } = useApp();
  const me = state.user;
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);       // { text, tone: 'hint' | 'error' }

  /* App only renders this behind a signed-in user, but signing out from this
     very screen unmounts it mid-flight — without this the render below would
     reach into a null user on the way out. */
  if (!me) return null;

  const verified = me.emailVerified;
  const working = busy !== '';
  const say = (text, tone = 'hint') => setMsg({ text, tone });

  const resend = async () => {
    setBusy('send'); setMsg(null);
    try {
      await resendVerification();
      say(firebaseEnabled
        ? 'Đã gửi. Mở hộp thư, bấm liên kết trong email, rồi quay lại đây bấm "Tôi đã xác minh xong".'
        : 'Chế độ thử không gửi mail thật. Dùng nút "Giả lập đã xác minh" bên dưới để xem trạng thái sau khi xác minh.');
    } catch (err) {
      console.error('SmartTrip · gửi email xác minh:', err);
      say('Chưa gửi được. Thử lại sau một lát.', 'error');
    } finally {
      setBusy('');
    }
  };

  /* Reloads the session and, if the address turned out to be confirmed, picks
     up any invitation that was waiting on it — the store action does both. */
  const recheck = async () => {
    setBusy('check'); setMsg(null);
    const ok = await actions.refreshUser();
    if (!ok) say('Vẫn chưa thấy xác minh. Bấm liên kết trong email rồi thử lại.', 'error');
    setBusy('');
  };

  const simulate = async () => {
    setBusy('demo'); setMsg(null);
    try {
      await verifyDemoEmail();
    } catch (err) {
      console.error('SmartTrip · xác minh chế độ thử:', err);
      say('Không đổi được trạng thái ở chế độ thử.', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="st-page st-page-narrow" style={{ paddingTop: 24 }}>
      <button type="button" className="btn btn-ghost" style={{ marginLeft: -10 }} onClick={() => go('trips')}>
        <ChevronLeft width="15" height="15" />Tất cả chuyến đi
      </button>

      <header className="st-rise" style={{ marginTop: 8 }}>
        <span className="st-eyebrow">Tài khoản<En>&nbsp;· Profile</En></span>
        <h1 className="st-display">Trang cá nhân</h1>
        <p className="st-lede" style={{ margin: '14px 0 0', maxWidth: '58ch' }}>
          Thông tin đăng nhập của bạn và trạng thái xác minh email — thứ quyết định
          bạn có nhận được lời mời vào chuyến đi của người khác hay không.
        </p>
      </header>

      <section aria-label="Thông tin tài khoản" style={{ marginTop: 30 }}>
        <div className="st-member">
          <Avatar initial={(me.name || '?')[0].toUpperCase()} size={52} />
          <span style={{ minWidth: 0 }}>
            <span className="st-member-name">{me.name}</span>
            <span className="st-member-mail">{me.email || 'Chưa có địa chỉ email'}</span>
          </span>
          <span style={{ flex: 1 }} />
          <span className="tag">{PROVIDER[me.provider] ?? 'Email và mật khẩu'}</span>
          {verified ? (
            <span className="tag tag-accent-2"><Check width="12" height="12" />Đã xác minh</span>
          ) : (
            <span className="tag tag-accent">Chưa xác minh</span>
          )}
        </div>
      </section>

      <section aria-label="Xác minh email" style={{ marginTop: 32 }}>
        <h2 style={{ margin: '0 0 5px', fontSize: 27 }}>Xác minh email</h2>

        {verified ? (
          <>
            <p className="st-daysub" style={{ maxWidth: '58ch' }}>
              Địa chỉ <b>{me.email}</b> đã được xác minh. Ai mời bạn vào chuyến đi bằng
              chính địa chỉ này thì chuyến đó tự hiện trong danh sách của bạn.
              <En> · Email verified</En>
            </p>
            <p className="st-hint" style={{ marginTop: 18, display: 'inline-flex' }}>
              <Check width="15" height="15" />
              <span>Không còn gì cần làm ở đây.</span>
            </p>
          </>
        ) : (
          <>
            <p className="st-daysub" style={{ maxWidth: '58ch' }}>
              Địa chỉ <b>{me.email}</b> chưa được xác minh. Chừng nào chưa xác minh,
              SmartTrip không cho tài khoản này nhận lời mời — nếu không thì ai cũng có
              thể đăng ký bằng email của người khác rồi đi thẳng vào chuyến của họ.
              <En> · Verify your email</En>
            </p>

            <ol className="st-daysub" style={{ maxWidth: '58ch', paddingLeft: 20, lineHeight: 1.9 }}>
              <li>Bấm <b>Gửi email xác minh</b> — SmartTrip gửi một liên kết tới {me.email}.</li>
              <li>Mở hộp thư và bấm liên kết đó.</li>
              <li>Quay lại đây, bấm <b>Tôi đã xác minh xong</b>.</li>
            </ol>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
              <button type="button" className="btn btn-primary" onClick={resend} disabled={working}>
                {busy === 'send' ? 'Đang gửi…' : 'Gửi email xác minh'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={recheck} disabled={working}>
                {busy === 'check' ? 'Đang kiểm tra…' : 'Tôi đã xác minh xong'}
              </button>
            </div>

            {!firebaseEnabled && (
              <div className="st-hint" style={{ marginTop: 20 }}>
                <span>
                  Chế độ thử: không có hộp thư nào để gửi tới, nên đây là nút thay cho
                  việc bấm liên kết trong email.
                </span>
                <span style={{ flex: 1 }} />
                <button type="button" className="btn btn-ghost" onClick={simulate} disabled={working}>
                  {busy === 'demo' ? 'Đang xử lý…' : 'Giả lập đã xác minh'}
                </button>
              </div>
            )}
          </>
        )}

        {msg && (
          <p className={msg.tone === 'error' ? 'st-error' : 'text-muted'}
            role="status" aria-live="polite" style={{ marginTop: 14, maxWidth: '58ch' }}>
            {msg.text}
          </p>
        )}
      </section>

      <section aria-label="Phiên đăng nhập" style={{ marginTop: 38 }}>
        <h2 style={{ margin: '0 0 5px', fontSize: 21 }}>Phiên đăng nhập</h2>
        <p className="st-daysub" style={{ maxWidth: '58ch' }}>
          {firebaseEnabled
            ? 'Đăng xuất khỏi thiết bị này. Chuyến đi nằm trên máy chủ nên vẫn còn nguyên khi bạn đăng nhập lại.'
            : 'Chế độ thử: chuyến đi chỉ lưu trong trình duyệt này, đăng xuất không xoá chúng.'}
        </p>
        <button type="button" className="btn btn-ghost st-danger" style={{ marginTop: 14, marginLeft: -10 }}
          onClick={() => signOutUser()}>
          Đăng xuất
        </button>
      </section>
    </div>
  );
}
