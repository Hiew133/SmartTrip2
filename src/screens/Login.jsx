import { useState } from 'react';
import { useApp } from '../store.jsx';
import { photo } from '../data.js';
import { ArrowRight, Pin, Photo } from '../components/ui.jsx';

export default function Login() {
  const { state, patch, go } = useApp();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const isSignup = state.auth === 'up';
  const emailBad = touched && !/^\S+@\S+\.\S+$/.test(email);

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    go('trips');
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

          <div className="st-seg" style={{ marginBottom: 22 }} role="group" aria-label="Đăng nhập hoặc đăng ký">
            <button type="button" className={!isSignup ? 'active' : ''} aria-pressed={!isSignup}
              style={{ padding: '8px 20px' }} onClick={() => patch({ auth: 'in' })}>Đăng nhập</button>
            <button type="button" className={isSignup ? 'active' : ''} aria-pressed={isSignup}
              style={{ padding: '8px 20px' }} onClick={() => patch({ auth: 'up' })}>Đăng ký</button>
          </div>

          <form onSubmit={submit} noValidate>
            <div style={{ display: 'grid', gap: 15 }}>
              {isSignup && (
                <div className="field">
                  <label htmlFor="st-name">Họ tên<span className="st-en"> · Full name</span></label>
                  <input className="input" id="st-name" placeholder="Trần Hoài Minh" autoComplete="name" />
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
                  autoComplete={isSignup ? 'new-password' : 'current-password'} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 20 }}>
              {isSignup ? 'Tạo tài khoản' : 'Đăng nhập'}<ArrowRight width="15" height="15" />
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }}>Quên mật khẩu?</button>
            <span className="st-en text-muted" style={{ fontSize: 12 }}>Forgot password</span>
          </div>

          <p className="st-rule">hoặc<span className="st-en">&nbsp;· or</span></p>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => go('trips')}>
            Tiếp tục với Google
          </button>
          <p className="st-fineprint">
            Bằng việc tiếp tục, bạn đồng ý với <a href="#dieu-khoan">Điều khoản sử dụng</a> và{' '}
            <a href="#rieng-tu">Chính sách riêng tư</a> của SmartTrip.
          </p>
        </div>
      </section>

      <aside className="st-login-art" aria-hidden="true">
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
