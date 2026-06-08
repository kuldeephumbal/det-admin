'use client';
import { useEffect, useState } from 'react';

const TONES = {
  error: {
    bg: 'bg-gradient-to-br from-rose-500 to-rose-600',
    text: 'text-white',
    ring: 'ring-rose-500/40',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="13" />
        <line x1="12" y1="16.5" x2="12" y2="16.5" strokeLinecap="round" />
      </svg>
    ),
  },
  success: {
    bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    text: 'text-white',
    ring: 'ring-emerald-500/40',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
        <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  info: {
    bg: 'bg-gradient-to-br from-slate-800 to-slate-950',
    text: 'text-white',
    ring: 'ring-slate-700/40',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="11" x2="12" y2="17" strokeLinecap="round" />
        <line x1="12" y1="7.5" x2="12" y2="7.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

/**
 * Top-of-screen sliding toast.
 *
 *   <Toast
 *     toast={toast}                 // { kind, message } | null
 *     onClose={() => setToast(null)}
 *     durationMs={5000}             // optional, default 5s; pass 0 to make it sticky
 *   />
 *
 * Keeps animation logic local so the consumer only manages `{kind, message}`.
 */
export default function Toast({ toast, onClose, durationMs = 5000 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return undefined;
    }
    // Trigger transition on the next frame so the initial state animates in.
    const showTimer = setTimeout(() => setVisible(true), 10);
    let hideTimer;
    if (durationMs > 0) {
      hideTimer = setTimeout(() => {
        setVisible(false);
        // Wait for the fade-out before unmounting from the parent's state.
        setTimeout(() => onClose?.(), 200);
      }, durationMs);
    }
    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [toast, durationMs, onClose]);

  if (!toast) return null;

  const tone = TONES[toast.kind] || TONES.info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed top-5 left-1/2 -translate-x-1/2 z-50',
        'transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95',
      ].join(' ')}
    >
      <div
        className={[
          tone.bg, tone.text,
          'flex items-start gap-3',
          'px-4 py-3.5 pr-3 rounded-2xl shadow-card-deep ring-1', tone.ring,
          'max-w-md min-w-[300px]',
        ].join(' ')}
      >
        <div className="shrink-0 mt-0.5">{tone.icon}</div>
        <div className="flex-1 text-sm font-medium leading-snug">{toast.message}</div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setVisible(false);
            setTimeout(() => onClose?.(), 200);
          }}
          className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 hover:bg-white/10 transition"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
            <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
            <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
