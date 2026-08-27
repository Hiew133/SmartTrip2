import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import { Check, Compass, Pin } from './ui.jsx';

const ICON = { accent: Compass, sage: Check, neutral: Pin };

/* Lightweight toast: auto-dismisses, animates in from below. Only UI state —
   nothing persisted, safe to lose. */
export default function Toast() {
  const { state, patch } = useApp();
  const toast = state.toast;
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setLeaving(false);
    const t = setTimeout(() => setLeaving(true), 2600);
    const hide = setTimeout(() => patch({ toast: null }), 3000);
    return () => { clearTimeout(t); clearTimeout(hide); };
  }, [toast, patch]);

  if (!toast) return null;
  const Icon = ICON[toast.tone] || Pin;

  return (
    <div className={`st-toast ${leaving ? 'leaving' : ''}`} role="status" aria-live="polite">
      <span className={`st-toast-icon st-toast-${toast.tone}`}><Icon width="15" height="15" /></span>
      <span>{toast.msg}</span>
    </div>
  );
}