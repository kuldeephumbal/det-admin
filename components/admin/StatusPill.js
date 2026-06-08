const TONES = {
  active:    'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  blocked:   'bg-rose-50 text-rose-700 ring-rose-200/70',
  deleted:   'bg-slate-100 text-slate-600 ring-slate-200',
  admin:     'bg-violet-50 text-violet-700 ring-violet-200/70',
  user:      'bg-slate-50 text-slate-700 ring-slate-200',
  premium:   'bg-amber-50 text-amber-800 ring-amber-200/70',
  free:      'bg-slate-50 text-slate-700 ring-slate-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200/70',
  expired:   'bg-slate-100 text-slate-600 ring-slate-200',
  trialing:  'bg-sky-50 text-sky-700 ring-sky-200/70',
};

const DOT = {
  active:    'bg-emerald-500',
  blocked:   'bg-rose-500',
  deleted:   'bg-slate-400',
  admin:     'bg-violet-500',
  user:      'bg-slate-400',
  premium:   'bg-amber-500',
  free:      'bg-slate-400',
  cancelled: 'bg-rose-500',
  expired:   'bg-slate-400',
  trialing:  'bg-sky-500',
};

export default function StatusPill({ value, withDot = true }) {
  const klass = TONES[value] || 'bg-slate-50 text-slate-700 ring-slate-200';
  const dot = DOT[value] || 'bg-slate-400';
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1',
        'text-[11px] font-semibold capitalize',
        klass,
      ].join(' ')}
    >
      {withDot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
      {value || '—'}
    </span>
  );
}
