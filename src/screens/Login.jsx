import { useState } from 'react';
import { useApp } from '../store.jsx';
import { photo } from '../data.js';
import {
  authMessage, firebaseEnabled, missingKeys,
  signInWithEmail, signInWithGoogle, signUpWithEmail,
} from '../backend/index.js';
import { ArrowRight, Pin, Photo } from '../components/ui.jsx';

export default function Login() {
  const { state, patch } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const isSignup = state.auth === 'up';
  const emailBad = touched && !/^\S+@\S+\.\S+$/.test(email);

  /* No navigation here: the auth listener in the store moves the app to the
     trip list the moment Firebase reports a signed-in user. */
  const attempt = async (fn) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    if (password.length < 6) {
      setErr('Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }
    attempt(() => (isSignup ? signUpWithEmail(name.trim(), email, password) : signInWithEmail(email, password)));
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div className="st-login">
      <section className="st-login-form">
        <div className="st-login-inner st-rise">
          <span className="st-logomark">
            <Pin width="26" height="26" /><span>SmartTrip</span>
          </span>
          <h1 className="st-login-title">Lên kế hoạch cùng nhau, đi cùng nhau.</h1>
          <p className="st-lede" style={{ fontSize: 15, marginBottom: 22 }}>
            {greeting}. Soạn lịch trình, chia tiền và giữ cả nhóm trên cùng một trang.
            <span className="st-en text-muted"> · Plan together, travel together.</span>
          </p>

          {/* Without a project every button on this screen is a stand-in, and
              they look exactly like the real ones — say so here rather than
              letting someone conclude Google sign-in is broken. */}
          {!firebaseEnabled && (
            <p className="st-hint" style={{ marginBottom: 20 }}>
              Chế độ thử: chưa có project Firebase — đăng nhập là mô phỏng, dữ liệu chỉ nằm trong máy này.
            </p>
          )}

          <div className="st-seg" style={{ marginBottom: 22 }} role="group" aria-label="Đăng nhập hoặc đăng ký">
            <button type="button" className={!isSignup ? 'active' : ''} aria-pressed={!isSignup}
              style={{ padding: '8px 20px' }} onClick={() => { patch({ auth: 'in' }); setErr(''); }}>Đăng nhập</button>
            <button type="button" className={isSignup ? 'active' : ''} aria-pressed={isSignup}
              style={{ padding: '8px 20px' }} onClick={() => { patch({ auth: 'up' }); setErr(''); }}>Đăng ký</button>
          </div>

          <form onSubmit={submit} noValidate>
            <div style={{ display: 'grid', gap: 15 }}>
              {isSignup && (
                <div className="field">
                  <label htmlFor="st-name">Họ tên<span className="st-en"> · Full name</span></label>
                  <input className="input" id="st-name" placeholder="Trần Hoài Minh" autoComplete="name"
                    value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              )}
              <div className="field">
                <label htmlFor="st-email">Email</label>
                <input className="input" id="st-email" type="email" placeholder="minh.tran@gmail.com"
                  autoComplete="email" value={email} aria-invalid={emailBad}
                  aria-describedby={emailBad ? 'st-email-err' : undefined}
                  onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} />
                {emailBad && (
                  <span className="st-error" id="st-email-err">
                    Email chưa đúng định dạng. Ví dụ: minh.tran@gmail.com
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="st-pass">Mật khẩu<span className="st-en"> · Password</span></label>
                <input className="input" id="st-pass" type="password" placeholder="••••••••"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            {err && <p className="st-error" role="alert" style={{ marginTop: 12 }}>{err}</p>}

            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 20 }} disabled={busy}>
              {busy ? 'Đang xử lý…' : (isSignup ? 'Tạo tài khoản' : 'Đăng nhập')}
              {!busy && <ArrowRight width="15" height="15" />}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }}>Quên mật khẩu?</button>
            <span className="st-en text-muted" style={{ fontSize: 12 }}>Forgot password</span>
          </div>

          <p className="st-rule">hoặc<span className="st-en">&nbsp;· or</span></p>
          <button type="button" className="btn btn-secondary btn-block" disabled={busy}
            onClick={() => attempt(signInWithGoogle)}>
            {firebaseEnabled ? 'Tiếp tục với Google' : 'Tiếp tục với Google (mô phỏng)'}
          </button>

          {!firebaseEnabled && (
            <p className="st-fineprint">
              Nút này không mở cửa sổ Google thật — nó tạo sẵn một tài khoản mẫu đã xác minh,
              nên trang cá nhân sẽ không có gì để xác minh nữa. Muốn xem luồng xác minh email
              thì <b>Đăng ký</b> bằng email và mật khẩu. Muốn tài khoản Google thật và email
              xác minh thật thì cần <b>.env.local</b> — hiện thiếu: {missingKeys.join(', ')}.
            </p>
          )}
          <p className="st-fineprint">
            Bằng việc tiếp tục, bạn đồng ý với <a href="#dieu-khoan">Điều khoản sử dụng</a> và{' '}
            <a href="#rieng-tu">Chính sách riêng tư</a> của SmartTrip.
          </p>
        </div>
      </section>

      <aside className="st-login-art">
        <Photo src={photo('hoian-lanterns', 1400, 1800)}
          alt="Đèn lồng phố cổ Hội An phản chiếu trên sông Hoài" />
        <figure className="st-login-quote">
          <blockquote>Bốn ngày, mười lăm điểm dừng, một nhóm bạn — và không ai phải nhớ mình đã ứng bao nhiêu.</blockquote>
          <figcaption>Đà Nẵng – Hội An · tháng 9, 2026</figcaption>
        </figure>
      </aside>
    </div>
  );
}
