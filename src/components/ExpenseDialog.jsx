import { useEffect, useRef, useState } from 'react';
import { useApp, computeBudget } from '../store.jsx';
import { CATEGORIES, first, fmt } from '../data.js';
import { Seg } from './ui.jsx';

const parseAmount = (raw) => parseInt((raw || '').replace(/[^\d]/g, ''), 10) || 0;

export default function ExpenseDialog() {
  const { state, patch } = useApp();
  const { core } = computeBudget(state);
  const [err, setErr] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && patch({ showAdd: false });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [patch]);

  const close = () => patch({ showAdd: false });
  const amount = parseAmount(state.draftAmt);

  const save = () => {
    if (amount <= 0) {
      setErr('Nhập số tiền lớn hơn 0 để lưu khoản chi.');
      return;
    }
    patch((s) => ({
      expenses: [...s.expenses, { n: s.draftName.trim() || 'Khoản chi khác', cat: s.draftCat, p: s.draftPayer, a: amount }],
      showAdd: false, draftName: '', draftAmt: '',
    }));
  };

  return (
    <div className="dialog-backdrop" onClick={close}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="ex-title"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title" id="ex-title">Thêm khoản chi</h2>

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
            : amount > 0 && (
              <span className="text-muted" id="ex-hint" style={{ fontSize: 12.5, display: 'block', marginTop: 6 }}>
                {fmt(amount)} · mỗi người {fmt(amount / core.length)}
              </span>
            )}
        </div>

        <div className="field">
          <label>Người ứng</label>
          <Seg ariaLabel="Người ứng tiền" options={core.map((m, i) => ({
            label: first(m.n), active: state.draftPayer === i, onClick: () => patch({ draftPayer: i }),
            style: { padding: '7px 14px' },
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
          <button type="button" className="btn btn-primary" onClick={save}>Lưu khoản chi</button>
        </div>
      </div>
    </div>
  );
}
