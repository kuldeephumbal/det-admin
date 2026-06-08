import StatCard from '@/components/admin/StatCard';
import StatusPill from '@/components/admin/StatusPill';
import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/admin/serverAuth';

export const dynamic = 'force-dynamic';

const fmt = new Intl.NumberFormat('en-IN');

const dayLabel = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const weekday = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
};

export default async function AdminDashboard() {
  await connectDB();
  const [data, who] = await Promise.all([admin.dashboard(), requireAdmin()]);
  const firstName = (who.name || 'there').split(' ')[0];

  const maxTrend = Math.max(1, ...data.registrationTrend.map((t) => t.count));

  return (
    <>
      <Topbar title="Dashboard" subtitle="Operational overview" />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-6 lg:space-y-8">
        {/* Hero greeting */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white animate-fade-in-up">
          <div aria-hidden="true" className="absolute inset-0 bg-mesh-light" />
          <div aria-hidden="true" className="absolute -bottom-10 -right-10 w-72 h-72 rounded-full bg-gradient-to-br from-brand-500/20 to-violet-500/10 blur-3xl" />
          <div className="relative px-6 lg:px-8 py-7 lg:py-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200/70 text-[11px] font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-glow" />
              Live
            </div>
            <h2 className="mt-3 text-2xl lg:text-3xl font-bold text-slate-900 tracking-tightest">
              Good to see you, <span className="text-gradient-brand">{firstName}</span>
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">Here&apos;s how DET is doing right now.</p>
          </div>
        </section>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4" data-stagger>
          <StatCard
            label="Total users"
            value={data.totals.users}
            delta={`${fmt.format(data.totals.activeUsers)} active in 30d`}
            tone="brand"
            icon={<IconUsers />}
          />
          <StatCard
            label="New today"
            value={data.totals.newToday}
            delta={`${fmt.format(data.totals.newThisWeek)} this week`}
            tone="emerald"
            icon={<IconSpark />}
          />
          <StatCard
            label="New this month"
            value={data.totals.newThisMonth}
            delta="MTD signups"
            tone="amber"
            icon={<IconCalendar />}
          />
          <StatCard
            label="Premium"
            value={data.plans.premium}
            delta={`${fmt.format(data.plans.free)} on Free`}
            tone="rose"
            icon={<IconCrown />}
          />
        </div>

        {/* Chart + subscriptions */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          <div className="lg:col-span-2 surface surface-hover p-5 lg:p-6 animate-fade-in-up">
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  New users — last {data.trendWindowDays || 7} days
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Daily signups</p>
              </div>
              <span className="text-xs font-medium text-slate-500 px-2.5 py-1 rounded-full bg-slate-100">
                {fmt.format(data.registrationTrend.reduce((s, t) => s + t.count, 0))} total
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2 lg:gap-3 items-end h-48">
              {data.registrationTrend.map((t, i) => {
                const pct = (t.count / maxTrend) * 100;
                const isToday = i === data.registrationTrend.length - 1;
                return (
                  <div
                    key={t.date}
                    className="flex flex-col items-center justify-end h-full group/bar"
                    title={`${dayLabel(t.date)} — ${t.count} signup${t.count === 1 ? '' : 's'}`}
                  >
                    <div className="relative w-full flex flex-col items-center justify-end flex-1">
                      {t.count > 0 && (
                        <span className="mb-1 text-[11px] font-bold text-slate-900">
                          {t.count}
                        </span>
                      )}
                      <div
                        className={[
                          'w-full rounded-t-lg origin-bottom animate-fade-in-up',
                          'transition-all duration-200 group-hover/bar:scale-y-[1.04]',
                          t.count > 0
                            ? 'bg-gradient-to-t from-brand-500 to-violet-500 opacity-90 group-hover/bar:opacity-100'
                            : 'bg-slate-200/70',
                        ].join(' ')}
                        style={{
                          height: `${t.count > 0 ? Math.max(10, (pct / 100) * 130) : 6}px`,
                          animationDelay: `${i * 60}ms`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex flex-col items-center">
                      <span className={`text-[10px] font-semibold ${isToday ? 'text-brand-700' : 'text-slate-500'}`}>
                        {isToday ? 'Today' : weekday(t.date)}
                      </span>
                      <span className="text-[10px] text-slate-400">{dayLabel(t.date)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="surface surface-hover p-5 lg:p-6 animate-fade-in-up">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Subscriptions</h2>
            <p className="text-xs text-slate-500 mb-5">Across all users</p>
            <div className="grid grid-cols-2 gap-3" data-stagger>
              <SubBox label="Active"    value={data.subscriptions.active}    tone="emerald" />
              <SubBox label="Trialing"  value={data.subscriptions.trialing}  tone="sky" />
              <SubBox label="Cancelled" value={data.subscriptions.cancelled} tone="rose" />
              <SubBox label="Expired"   value={data.subscriptions.expired}   tone="slate" />
            </div>
          </div>
        </section>

        {/* Recent users */}
        <section className="surface overflow-hidden animate-fade-in-up">
          <div className="px-5 lg:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent registrations</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest 8 sign-ups</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="bg-slate-50/60 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">User</th>
                  <th className="text-left px-4 py-3 font-semibold">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.recentUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400">No users yet</td>
                  </tr>
                ) : (
                  data.recentUsers.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 lg:px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div>
                            <div className="font-semibold text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusPill value={u.plan} /></td>
                      <td className="px-4 py-3"><StatusPill value={u.status} /></td>
                      <td className="px-4 py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

function SubBox({ label, value, tone }) {
  const tones = {
    emerald: { bg: 'from-emerald-500/15 to-emerald-500/0', ring: 'ring-emerald-200', text: 'text-emerald-700' },
    sky:     { bg: 'from-sky-500/15 to-sky-500/0',         ring: 'ring-sky-200',     text: 'text-sky-700' },
    rose:    { bg: 'from-rose-500/15 to-rose-500/0',       ring: 'ring-rose-200',    text: 'text-rose-700' },
    slate:   { bg: 'from-slate-500/15 to-slate-500/0',     ring: 'ring-slate-200',   text: 'text-slate-700' },
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-xl ring-1 ${t.ring} bg-gradient-to-br ${t.bg} px-3 py-3 animate-fade-in-up`}>
      <div className={`text-[10px] uppercase font-semibold tracking-wider ${t.text}`}>{label}</div>
      <div className="text-xl font-bold text-slate-900 mt-1 tracking-tight">{fmt.format(value)}</div>
    </div>
  );
}

function Avatar({ name }) {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  const palette = [
    'from-brand-500 to-violet-600',
    'from-sky-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-rose-500 to-pink-500',
    'from-amber-400 to-orange-500',
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const gradient = palette[Math.abs(hash) % palette.length];
  return (
    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient}
                     grid place-items-center font-bold text-white text-sm shadow-inner-soft`}>
      {initial}
    </div>
  );
}

/* ----- Icons ----- */

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  );
}
function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
      <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconCrown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M3 17h18l-2-9-4 4-3-7-3 7-4-4z" strokeLinejoin="round" />
    </svg>
  );
}
