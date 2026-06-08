import CountUp from './CountUp';

const TONES = {
  brand:   { from: 'from-brand-500',   to: 'to-violet-600',  ring: 'ring-brand-500/15' },
  emerald: { from: 'from-emerald-500', to: 'to-teal-500',    ring: 'ring-emerald-500/15' },
  amber:   { from: 'from-amber-400',   to: 'to-orange-500',  ring: 'ring-amber-500/15' },
  rose:    { from: 'from-rose-500',    to: 'to-pink-500',    ring: 'ring-rose-500/15' },
  zinc:    { from: 'from-slate-700',   to: 'to-slate-900',   ring: 'ring-slate-500/15' },
};

/**
 * Premium stat tile.
 *
 *   <StatCard
 *     label="Total users"
 *     value={1284}              // number → animated count-up
 *     delta="+12% vs last week"
 *     tone="brand"
 *     icon={<svg ... />}        // optional, sits in a gradient badge
 *   />
 */
export default function StatCard({ label, value, delta, tone = 'zinc', icon }) {
  const t = TONES[tone] || TONES.zinc;
  return (
    <div
      className="group relative rounded-2xl border border-slate-200 bg-white p-5
                 shadow-card hover:shadow-card-hover hover:-translate-y-0.5
                 transition-all duration-200 animate-fade-in-up overflow-hidden"
    >
      {/* Decorative wash behind the icon corner */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-0
                    group-hover:opacity-60 transition-opacity duration-300
                    bg-gradient-to-br ${t.from} ${t.to}`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-slate-500">{label}</p>
          <div className="mt-2 text-[26px] leading-none font-bold text-slate-900 tracking-tight">
            {typeof value === 'number' ? <CountUp value={value} /> : value}
          </div>
          {delta != null && (
            <p className="mt-1.5 text-xs text-slate-500">{delta}</p>
          )}
        </div>

        {icon && (
          <div
            className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${t.from} ${t.to}
                        grid place-items-center text-white shadow-inner-soft ring-1 ${t.ring}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
