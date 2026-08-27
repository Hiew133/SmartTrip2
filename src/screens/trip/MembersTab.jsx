import { useRef, useState } from 'react';
import { useApp } from '../../store.jsx';
import { Avatar, Check, Seg } from '../../components/ui.jsx';

const SHARE_LINK = 'https://smarttrip.vn/t/dnha-0926';
const ROLE_LABEL = { edit: 'Sửa', view: 'Xem' };

export default function MembersTab() {
  const { state, patch, notify } = useApp();
  const copyTimer = useRef(null);
  const [inviteErr, setInviteErr] = useState('');

  const setRole = (idx, role) => patch((s) => ({
    members: s.members.map((m, j) => (j === idx ? { ...m, role } : m)),
  }));

  const sendInvite = () => {
    const e = state.inviteEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) {
      setInviteErr('Nhập một địa chỉ email hợp lệ để gửi lời mời.');
      return;
    }
    if (state.members.some((m) => m.e.toLowerCase() === e.toLowerCase())) {
      setInviteErr('Người này đã có trong chuyến đi.');
      return;
    }
    setInviteErr('');
    const name = e.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    patch((s) => ({
      members: [...s.members, { n: name, e, role: s.inviteRole, pending: true }],
      inviteEmail: '',
    }));
    notify(`Đã gửi lời mời tới ${e}`, 'sage');
  };

  const doCopy = () => {
    try { navigator.clipboard.writeText(SHARE_LINK); } catch { /* clipboard unavailable */ }
    patch({ copied: true });
    notify('Đã sao chép liên kết chia sẻ', 'sage');
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => patch({ copied: false }), 2000);
  };

  return (
    <section style={{ maxWidth: 740, marginTop: 30 }} aria-label="Thành viên và quyền">
      <h2 style={{ margin: '0 0 5px', fontSize: 27 }}>Thành viên &amp; quyền</h2>
      <p className="st-daysub" style={{ maxWidth: '58ch' }}>
        Ai cũng xem được lịch trình; chỉ người có quyền Sửa mới đổi được lịch và ngân sách.
        <span className="st-en"> · Roles &amp; permissions</span>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }} className="st-stagger">
        {state.members.map((m, i) => (
          <div key={m.e} className="st-member">
            <Avatar initial={m.n[0]} tone={i % 2} size={42} />
            <span style={{ minWidth: 0 }}>
              <span className="st-member-name">{m.n}</span>
              <span className="st-member-mail">{m.e}</span>
            </span>
            <span style={{ flex: 1 }} />
            {m.role === 'owner' && <span className="tag tag-accent">Chủ chuyến đi</span>}
            {m.pending && <span className="tag tag-accent-2">Chờ phản hồi</span>}
            {m.role !== 'owner' && !m.pending && (
              <Seg ariaLabel={`Quyền của ${m.n}`}
                options={['edit', 'view'].map((r) => ({
                  label: ROLE_LABEL[r], active: m.role === r, onClick: () => setRole(i, r),
                  style: { fontSize: 12, padding: '5px 13px' },
                }))} />
            )}
          </div>
        ))}
      </div>

      <div className="field" style={{ marginTop: 32 }}>
        <label htmlFor="st-invite">Mời qua email<span className="st-en"> · Invite by email</span></label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" id="st-invite" type="email" placeholder="banbe@example.com"
            style={{ flex: 1, minWidth: 220 }} value={state.inviteEmail}
            aria-invalid={!!inviteErr} aria-describedby={inviteErr ? 'st-invite-err' : undefined}
            onChange={(e) => { patch({ inviteEmail: e.target.value }); if (inviteErr) setInviteErr(''); }}
            onKeyDown={(e) => e.key === 'Enter' && sendInvite()} />
          <Seg ariaLabel="Quyền của người được mời" options={['edit', 'view'].map((r) => ({
            label: ROLE_LABEL[r], active: state.inviteRole === r,
            onClick: () => patch({ inviteRole: r }), style: { padding: '7px 16px' },
          }))} />
          <button type="button" className="btn btn-primary" onClick={sendInvite}>Gửi lời mời</button>
        </div>
        {inviteErr && <span className="st-error" id="st-invite-err">{inviteErr}</span>}
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="st-link">Hoặc chia sẻ liên kết<span className="st-en"> · Share link</span></label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="input" id="st-link" readOnly value={SHARE_LINK}
            style={{ flex: 1, color: 'color-mix(in srgb, var(--color-text) 66%, transparent)' }} />
          <button type="button" className="btn btn-secondary" onClick={doCopy}>
            {state.copied ? <><Check width="14" height="14" />Đã sao chép</> : 'Sao chép'}
          </button>
        </div>
      </div>
      <p className="st-fineprint">
        Người mở liên kết sẽ vào với quyền Xem. Chủ chuyến đi có thể nâng quyền bất cứ lúc nào.
      </p>
    </section>
  );
}
