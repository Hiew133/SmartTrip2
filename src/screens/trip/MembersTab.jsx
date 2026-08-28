import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store.jsx';
import { uid } from '../../data.js';
import { Avatar, Check, Seg } from '../../components/ui.jsx';

const ROLE_LABEL = { edit: 'Sửa', view: 'Xem' };

export default function MembersTab({ trip, role }) {
  const { state, patch, notify, actions } = useApp();
  const copyTimer = useRef(null);
  const linkRef = useRef(null);
  const [inviteErr, setInviteErr] = useState('');

  const isOwner = role === 'owner';
  const shareLink = `${window.location.origin}/t/${trip.id}`;

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const sendInvite = () => {
    const email = state.inviteEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setInviteErr('Nhập một địa chỉ email hợp lệ để gửi lời mời.');
      return;
    }
    if (trip.members.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
      setInviteErr('Người này đã có trong chuyến đi.');
      return;
    }
    setInviteErr('');
    const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    actions.addMember({ id: uid('mem'), name, email, role: state.inviteRole, pending: true, uid: null });
    patch({ inviteEmail: '' });
    notify(`Đã gửi lời mời tới ${email}`, 'sage');
  };

  /* writeText returns a promise, so the old try/catch never saw a rejection:
     a blocked clipboard still reported "Đã sao chép". Now the confirmation
     only appears on a resolved write, and a failure says what to do instead. */
  const doCopy = () => {
    const ok = () => {
      patch({ copied: true, copyErr: '' });
      notify('Đã sao chép liên kết chia sẻ', 'sage');
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => patch({ copied: false }), 2000);
    };
    const fail = () => {
      patch({ copied: false, copyErr: 'Trình duyệt không cho sao chép tự động — liên kết đã được bôi đen, bấm Ctrl+C.' });
      linkRef.current?.select();
    };
    try {
      const p = navigator.clipboard?.writeText(shareLink);
      if (p && typeof p.then === 'function') p.then(ok, fail);
      else fail();
    } catch {
      fail();
    }
  };

  return (
    <section style={{ maxWidth: 740, marginTop: 30 }} aria-label="Thành viên và quyền">
      <h2 style={{ margin: '0 0 5px', fontSize: 27 }}>Thành viên &amp; quyền</h2>
      <p className="st-daysub" style={{ maxWidth: '58ch' }}>
        Ai cũng xem được lịch trình; chỉ người có quyền Sửa mới đổi được lịch và ngân sách.
        <span className="st-en"> · Roles &amp; permissions</span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }} className="st-stagger">
        {trip.members.map((m, i) => (
          <div key={m.id} className="st-member">
            <Avatar initial={m.name[0]} tone={i % 2} size={42} />
            <span style={{ minWidth: 0 }}>
              <span className="st-member-name">{m.name}</span>
              <span className="st-member-mail">{m.email}</span>
            </span>
            <span style={{ flex: 1 }} />
            {m.role === 'owner' && <span className="tag tag-accent">Chủ chuyến đi</span>}
            {m.pending && <span className="tag tag-accent-2">Chờ phản hồi</span>}
            {m.role !== 'owner' && !m.pending && (isOwner ? (
              <Seg ariaLabel={`Quyền của ${m.name}`}
                options={['edit', 'view'].map((r) => ({
                  key: r, label: ROLE_LABEL[r], active: m.role === r,
                  onClick: () => actions.setMemberRole(m.id, r),
                  style: { fontSize: 12, padding: '5px 13px' },
                }))} />
            ) : (
              <span className="tag">{ROLE_LABEL[m.role]}</span>
            ))}
          </div>
        ))}
      </div>

      {isOwner && (
        <div className="field" style={{ marginTop: 32 }}>
          <label htmlFor="st-invite">Mời qua email<span className="st-en"> · Invite by email</span></label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="input" id="st-invite" type="email" placeholder="banbe@example.com"
              style={{ flex: 1, minWidth: 220 }} value={state.inviteEmail}
              aria-invalid={!!inviteErr} aria-describedby={inviteErr ? 'st-invite-err' : undefined}
              onChange={(e) => { patch({ inviteEmail: e.target.value }); if (inviteErr) setInviteErr(''); }}
              onKeyDown={(e) => e.key === 'Enter' && sendInvite()} />
            <Seg ariaLabel="Quyền của người được mời" options={['edit', 'view'].map((r) => ({
              key: r, label: ROLE_LABEL[r], active: state.inviteRole === r,
              onClick: () => patch({ inviteRole: r }), style: { padding: '7px 16px' },
            }))} />
            <button type="button" className="btn btn-primary" onClick={sendInvite}>Gửi lời mời</button>
          </div>
          {inviteErr && <span className="st-error" id="st-invite-err">{inviteErr}</span>}
        </div>
      )}

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="st-link">Hoặc chia sẻ liên kết<span className="st-en"> · Share link</span></label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="input" id="st-link" ref={linkRef} readOnly value={shareLink}
            aria-describedby={state.copyErr ? 'st-link-err' : undefined}
            style={{ flex: 1, color: 'color-mix(in srgb, var(--color-text) 66%, transparent)' }} />
          <button type="button" className="btn btn-secondary" onClick={doCopy}>
            {state.copied ? <><Check width="14" height="14" />Đã sao chép</> : 'Sao chép'}
          </button>
        </div>
        {state.copyErr && <span className="st-error" id="st-link-err">{state.copyErr}</span>}
      </div>
      <p className="st-fineprint">
        Người được mời vào trạng thái "Chờ phản hồi" cho tới lần đăng nhập đầu tiên bằng
        chính email đó — lúc đó chuyến đi tự hiện trong danh sách của họ. SmartTrip chưa tự
        gửi email, nên bạn vẫn phải báo họ một tiếng. Đăng nhập bằng Google là nhận được
        ngay; đăng ký bằng email và mật khẩu thì phải bấm liên kết xác minh trước.
      </p>
    </section>
  );
}
