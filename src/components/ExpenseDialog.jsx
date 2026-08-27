import { useEffect, useRef, useState } from 'react';
import { useApp, useActiveTrip, computeBudget } from '../store.jsx';
import { CATEGORIES, first, fmt, uid } from '../data.js';
import { Seg } from './ui.jsx';

const parseAmount = (raw) => parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10) || 0;

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export default function ExpenseDialog() {
  const { state, patch, patchTrip } = useApp();
  const trip = useActiveTrip();
  const { core } = computeBudget(trip);
  const [err, setErr] = useState('');
  const nameRef = useRef(null);
  const boxRef = useRef(null);

  const editing = state.editingExpenseId;

  useEffect(() => {
    const opener = document.activeElement;
    nameRef.current?.focus();

    /* aria-modal alone does not stop Tab from walking out into the page
       behind, so the dialog cycles focus itself and hands it back on close. */
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        patch({ showAdd: false, editingExpenseId: null });
        return;
      }
      if (e.key !== 'Tab' || !boxRef.current) return;
      const items = [...boxRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement === edge || !boxRef.current.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    };
    window.addEventListener('keydown', onKey, true);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (opener instanceof HTMLElement && document.body.contains(opener)) opener.focus();
    };
  }, [patch]);

  const close = () => patch({ showAdd: false, editingExpenseId: null });
  const amount = parseAmount(state.draftAmt);
  const payerId = state.draftPayerId ?? core[0]?.id ?? null;

  const save = () => {
    if (amount <= 0) {
      setErr('Nhập số tiền lớn hơn 0 để lưu khoản chi.');
      return;
    }
    if (!payerId) {
      setErr('Chuyến đi chưa có thành viên nào để ghi người ứng.');
      return;
    }
    patchTrip((t) => {
      const fields = {
        name: state.draftName.trim() || 'Khoản chi khác',
        cat: state.draftCat,
        payerId,
        amount,
      };
      return {
        expenses: editing
          ? t.expenses.map((e) => (e.id === editing ? { ...e, ...fields } : e))
          : [...t.expenses, { id: uid('exp'), ...fields }],
      };
    });
    patch({ showAdd: false, editingExpenseId: null, draftName: '', draftAmt: '' });
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="ex-title" ref={boxRef}>
        <h2 className="dialog-title" id="ex-title">{editing ? 'Sửa khoản chi' : 'Thêm khoản chi'}</h2>

        <div className="field">
          <label htmlFor="ex-name">Tên khoản chi</label>
          <input className="input" id="ex-name" ref={nameRef} placeholder="vd: Ăn tối hải sản"
            value={state.draftName} onChange={(e) => patch({ draftName: e.target.value })} />
        </div>

        <div className="field">
          <label htmlFor="ex-amt">Số tiền (₫)</label>
          <input className="input" id="ex-amt" inputMode="numeric" placeholder="850000"
            value={state.draftAmt} aria-invalid={!!err} aria-describedby={err ? 'ex-err' : 'ex-hint'}
            onChange={(e) => { patch({ draftAmt: e.target.value }); if (err) setErr(''); }}
            onKeyDown={(e) => e.key === 'Enter' && save()} />
          {err
            ? <span className="st-error" id="ex-err">{err}</span>
            : amount > 0 && core.length > 0 && (
              <span className="text-muted" id="ex-hint" style={{ fontSize: 12.5, display: 'block', marginTop: 6 }}>
                {fmt(amount)} · mỗi người {fmt(amount / core.length)}
              </span>
            )}
        </div>

        <div className="field">
          <label>Người ứng</label>
          <Seg ariaLabel="Người ứng tiền" options={core.map((m) => ({
            key: m.id, label: first(m.name), active: payerId === m.id,
            onClick: () => patch({ draftPayerId: m.id }), style: { padding: '7px 14px' },
          }))} />
        </div>

        <div className="field">
          <label>Nhóm chi</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" aria-pressed={state.draftCat === c}
                className={`st-chip ${state.draftCat === c ? 'active' : ''}`}
                style={{ fontSize: 12.5, padding: '6px 14px' }}
                onClick={() => patch({ draftCat: c })}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>Huỷ</button>
          <button type="button" className="btn btn-primary" onClick={save}>
            {editing ? 'Lưu thay đổi' : 'Lưu khoản chi'}
          </button>
        </div>
      </div>
    </div>
  );
}
