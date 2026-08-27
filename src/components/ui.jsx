import { useState } from 'react';

/* Icons — drawn here rather than pulled from Lucide/Feather so the set reads as
   SmartTrip's own. One stroke weight (2.2) across every glyph. */
const ico = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round',
};

export const ArrowRight = (p) => (
  <svg {...ico} {...p}><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></svg>
);
export const ChevronLeft = (p) => (
  <svg {...ico} {...p}><path d="m14 18-6-6 6-6" /></svg>
);
export const Plus = (p) => (
  <svg {...ico} {...p}><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);
/* a compass rose, not the usual "sparkles" wand */
export const Compass = (p) => (
  <svg {...ico} {...p}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="m15.4 8.6-2 5.4-5.4 2 2-5.4z" />
  </svg>
);
/* map pin doubling as the brand mark */
export const Pin = (p) => (
  <svg {...ico} {...p}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);
export const Route = (p) => (
  <svg {...ico} {...p}>
    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="5.5" r="2.5" />
    <path d="M8 18.5h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h1" />
  </svg>
);
export const Grip = (p) => (
  <svg {...ico} width="12" height="18" viewBox="0 0 12 18" {...p}>
    <circle cx="3.5" cy="4" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="4" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="9" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="9" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="3.5" cy="14" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="14" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);
export const Check = (p) => (
  <svg {...ico} {...p}><path d="m4.5 12.5 5 5 10-11" /></svg>
);
export const Users = (p) => (
  <svg {...ico} {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 20a6.4 6.4 0 0 1 12.4 0" />
    <path d="M16 5.2a3.4 3.4 0 0 1 0 6.6" /><path d="M17.6 14.4A6.4 6.4 0 0 1 21.2 20" />
  </svg>
);

export const muted = (pct = 55) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;

/* Photographic plate. The gradient underlay is the real surface — the image
   layers on top, so a blocked or slow request degrades to a duotone, never a gap. */
export function Photo({ src, alt, className = '', children, style }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`st-plate ${className}`} style={style}>
      {!failed && <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />}
      {children}
    </div>
  );
}

/* Pill segmented control. options: [{ key?, label, active, onClick, style }]
   Pass `key` whenever labels can repeat — two members called "Minh" would
   otherwise collide into a single React child. */
export function Seg({ options, style, ariaLabel }) {
  return (
    <span className="st-seg" style={style} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.key ?? o.label} type="button" className={o.active ? 'active' : ''}
          aria-pressed={o.active} style={o.style} onClick={o.onClick}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

/* Squircle initial avatar. tone: 0 → terracotta, 1 → sage, 2 → paper */
export function Avatar({ initial, tone = 0, size = 36, round = false, ring = false, style }) {
  const tones = [
    { bg: 'var(--color-accent-200)', fg: 'var(--color-accent-900)' },
    { bg: 'var(--color-accent-2-200)', fg: 'var(--color-accent-2-900)' },
    { bg: 'var(--color-neutral-200)', fg: 'var(--color-neutral-800)' },
  ];
  const t = tones[tone % tones.length];
  return (
    <span className={`st-avatar ${round ? 'st-avatar-round' : ''}`} aria-hidden="true" style={{
      width: size, height: size, background: t.bg, color: t.fg,
      fontSize: size >= 40 ? 15 : size <= 28 ? 11.5 : 13,
      boxShadow: ring ? '0 0 0 2.5px var(--color-bg)' : undefined,
      ...style,
    }}>{initial}</span>
  );
}
