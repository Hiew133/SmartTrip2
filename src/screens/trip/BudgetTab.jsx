import { useApp, computeBudget } from '../../store.jsx';
import { fmt, first, PLAN } from '../../data.js';
import { Avatar, Check, Plus, useCountUp } from '../../components/ui.jsx';

function Stat({ label, value, variant = 'muted' }) {
  const shown = useCountUp(value);
  return (
    <div className={`st-stat st-stat-${variant}`}>
      <span className="st-stat-label">{label}</span>
      <span className="st-stat-value">{fmt(shown)}</span>
    </div>
  );
}

export default function BudgetTab() {
  const { state, patch } = useApp();
  const { core, total, share, bal, transfers } = computeBudget(state);
  const pct = (total / PLAN) * 100;
  const over = pct > 100;
  const remaining = PLAN - total;

  return (
    <div className="st-2col">
      <section aria-label="Các khoản chi">
        <div className="st-stats st-stagger">
          <Stat label="Kế hoạch" value={PLAN} />
          <Stat label="Đã ghi" value={total} variant="accent" />
          <Stat label={remaining >= 0 ? 'Còn lại' : 'Vượt dự tính'}
            value={Math.abs(remaining)} variant={remaining >= 0 ? 'accent2' : 'accent'} />
          <Stat label={`Mỗi người (${core.length})`} value={share} />
        </div>

        <div className="st-meter" role="progressbar" aria-valuenow={Math.round(pct)}
          aria-valuemin={0} aria-valuemax={100} aria-label="Tỉ lệ ngân sách đã dùng">
          <div className={`st-meter-fill ${over ? 'over' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <p className="st-meter-label">
          Đã dùng {pct.toFixed(0)}% ngân sách · {state.expenses.length} khoản chi · cập nhật hôm nay
        </p>

        {state.expenses.length === 0 ? (
          <div className="st-empty">
            <h4>Chưa ghi khoản chi nào</h4>
            <p>Thêm khoản đầu tiên để SmartTrip tính phần mỗi người và ai còn nợ ai.</p>
            <button type="button" className="btn btn-primary" onClick={() => patch({ showAdd: true })}>
              <Plus width="15" height="15" />Thêm khoản chi
            </button>
          </div>
        ) : (
          <>
            <table className="table">
              <caption className="text-muted" style={{ captionSide: 'bottom', textAlign: 'left', fontSize: 12, paddingTop: 10 }}>
                Mọi khoản chia đều cho {core.length} thành viên chính.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Khoản chi</th><th scope="col">Nhóm</th>
                  <th scope="col">Người ứng</th><th scope="col" style={{ textAlign: 'right' }}>Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {state.expenses.map((e, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{e.n}</td>
                    <td className="text-muted">{e.cat}</td>
                    <td>{first(core[e.p]?.n ?? '—')}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(e.a)}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Tổng cộng</td><td /><td />
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td>
                </tr>
              </tbody>
            </table>
            <button type="button" className="btn btn-secondary" style={{ marginTop: 20 }}
              onClick={() => patch({ showAdd: true })}>
              <Plus width="15" height="15" />Thêm khoản chi
            </button>
          </>
        )}
      </section>

      <section aria-label="Chia tiền">
        <h2 style={{ margin: '0 0 5px', fontSize: 27 }}>Chia tiền</h2>
        <p className="st-daysub">
          Số dư sau khi chia đều<span className="st-en"> · Split balances</span>
        </p>
        <div className="st-balances st-stagger">
          {bal.map((b, i) => (
            <div key={b.name} className="st-balance">
              <Avatar initial={b.name[0]} tone={i % 2} size={34} />
              <span className="st-balance-name">{b.name}</span>
              <span className={`st-balance-amt ${b.amt >= 0 ? 'st-owed' : 'st-owes'}`}>
                {(b.amt >= 0 ? '+' : '−') + fmt(Math.abs(b.amt))}
              </span>
            </div>
          ))}
        </div>

        <h3 style={{ margin: '30px 0 5px', fontSize: 21 }}>Tất toán gọn nhất</h3>
        <p className="st-daysub">
          {transfers.length} giao dịch thay vì {(core.length * (core.length - 1)) / 2}
          <span className="st-en"> · Settle up</span>
        </p>
        <div>
          {transfers.map((t) => {
            const key = `${t.from}>${t.to}`;
            const done = !!state.settled[key];
            return (
              <div key={key} className={`st-settle ${done ? 'done' : ''}`}>
                <span className="st-settle-who">
                  {t.from} <span className="st-settle-arrow">→</span> <b>{t.to}</b>
                </span>
                <span style={{ flex: 1 }} />
                <span className="st-settle-amt">{fmt(t.a)}</span>
                <button type="button" className="st-settle-btn"
                  onClick={() => patch((s) => ({ settled: { ...s.settled, [key]: !done } }))}>
                  {done ? 'Hoàn tác' : <><Check width="13" height="13" style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />Đã trả</>}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
