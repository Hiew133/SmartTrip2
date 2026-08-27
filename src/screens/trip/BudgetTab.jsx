import { useState } from 'react';
import { useApp, useActiveTrip, computeBudget, settleKey, toggleSettled } from '../../store.jsx';
import { fmt, first } from '../../data.js';
import { Avatar, Check, Plus, useCountUp } from '../../components/ui.jsx';

/* `value` counts up from zero; `fallback` replaces it entirely when the number
   would be meaningless (no budget set yet, nobody to split between). */
function Stat({ label, value, fallback, variant = 'muted' }) {
  const shown = useCountUp(Number.isFinite(value) ? value : 0);
  return (
    <div className={`st-stat st-stat-${variant}`}>
      <span className="st-stat-label">{label}</span>
      <span className="st-stat-value">{fallback ?? fmt(shown)}</span>
    </div>
  );
}

const parseAmount = (raw) => parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10) || 0;

export default function BudgetTab() {
  const { patch, patchTrip } = useApp();
  const trip = useActiveTrip();
  const { core, total, share, bal, transfers } = computeBudget(trip);
  const [planDraft, setPlanDraft] = useState(null);   // null ⇒ showing the stored value
  const [confirmId, setConfirmId] = useState(null);

  const plan = trip.plan;
  const pct = plan > 0 ? (total / plan) * 100 : 0;
  const over = pct > 100;
  const remaining = plan - total;
  const byId = new Map(trip.members.map((m) => [m.id, m]));

  const openAdd = () => patch({
    showAdd: true, editingExpenseId: null,
    draftName: '', draftAmt: '', draftPayerId: core[0]?.id ?? null, draftCat: 'Ăn uống',
  });

  const openEdit = (e) => patch({
    showAdd: true, editingExpenseId: e.id,
    draftName: e.name, draftAmt: String(e.amount), draftPayerId: e.payerId, draftCat: e.cat,
  });

  const removeExpense = (id) => {
    patchTrip((t) => ({ expenses: t.expenses.filter((e) => e.id !== id) }));
    setConfirmId(null);
  };

  const commitPlan = () => {
    if (planDraft !== null) patchTrip(() => ({ plan: parseAmount(planDraft) }));
    setPlanDraft(null);
  };

  return (
    <div className="st-2col">
      <section aria-label="Các khoản chi">
        <div className="st-stats st-stagger">
          <Stat label="Kế hoạch" value={plan} fallback={plan > 0 ? undefined : 'Chưa đặt'} />
          <Stat label="Đã ghi" value={total} variant="accent" />
          <Stat label={remaining >= 0 ? 'Còn lại' : 'Vượt dự tính'}
            value={Math.abs(remaining)} fallback={plan > 0 ? undefined : '—'}
            variant={remaining >= 0 ? 'accent2' : 'accent'} />
          <Stat label={`Mỗi người (${core.length})`} value={share}
            fallback={core.length ? undefined : '—'} />
        </div>

        <div className="field st-planfield">
          <label htmlFor="bt-plan">Ngân sách kế hoạch (₫)</label>
          <input className="input" id="bt-plan" inputMode="numeric" placeholder="vd: 16000000"
            value={planDraft ?? (plan || '')}
            onChange={(e) => setPlanDraft(e.target.value)}
            onBlur={commitPlan}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        </div>

        {plan > 0 ? (
          <>
            <div className="st-meter" role="progressbar"
              aria-valuenow={Math.min(100, Math.round(pct))} aria-valuemin={0} aria-valuemax={100}
              aria-valuetext={`Đã dùng ${pct.toFixed(0)}% ngân sách`}
              aria-label="Tỉ lệ ngân sách đã dùng">
              <div className={`st-meter-fill ${over ? 'over' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="st-meter-label">
              Đã dùng {pct.toFixed(0)}% ngân sách · {trip.expenses.length} khoản chi
            </p>
          </>
        ) : (
          <p className="st-meter-label" style={{ marginTop: 12 }}>
            Chưa đặt ngân sách kế hoạch · {trip.expenses.length} khoản chi
          </p>
        )}

        {trip.expenses.length === 0 ? (
          <div className="st-empty">
            <h4>Chưa ghi khoản chi nào</h4>
            <p>Thêm khoản đầu tiên để SmartTrip tính phần mỗi người và ai còn nợ ai.</p>
            <button type="button" className="btn btn-primary" onClick={openAdd}>
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
                  <th scope="col"><span className="st-sr">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {trip.expenses.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td className="text-muted">{e.cat}</td>
                    <td>{first(byId.get(e.payerId)?.name ?? '—')}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(e.amount)}</td>
                    <td className="st-rowacts">
                      {confirmId === e.id ? (
                        <>
                          <button type="button" className="st-linkbtn st-danger" onClick={() => removeExpense(e.id)}>
                            Xoá hẳn?
                          </button>
                          <button type="button" className="st-linkbtn" onClick={() => setConfirmId(null)}>Giữ</button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="st-linkbtn" onClick={() => openEdit(e)}
                            aria-label={`Sửa ${e.name}`}>Sửa</button>
                          <button type="button" className="st-linkbtn st-danger" onClick={() => setConfirmId(e.id)}
                            aria-label={`Xoá ${e.name}`}>Xoá</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td style={{ fontWeight: 700 }}>Tổng cộng</td><td /><td />
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(total)}</td><td />
                </tr>
              </tbody>
            </table>
            <button type="button" className="btn btn-secondary" style={{ marginTop: 20 }} onClick={openAdd}>
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
            <div key={b.id} className="st-balance">
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
          {transfers.length === 0
            ? 'Không ai còn nợ ai.'
            : `${transfers.length} giao dịch là đủ để cả nhóm sạch nợ`}
          <span className="st-en"> · Settle up</span>
        </p>
        <div>
          {transfers.map((t) => {
            const key = settleKey(t);
            const done = !!trip.settled[key];
            return (
              <div key={key} className={`st-settle ${done ? 'done' : ''}`}>
                <span className="st-settle-who">
                  {t.from} <span className="st-settle-arrow">→</span> <b>{t.to}</b>
                </span>
                <span style={{ flex: 1 }} />
                <span className="st-settle-amt">{fmt(t.a)}</span>
                <button type="button" className="st-settle-btn"
                  onClick={() => patchTrip((tr) => ({ settled: toggleSettled(tr.settled, transfers, key) }))}>
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
