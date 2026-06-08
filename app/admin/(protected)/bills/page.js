import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-IN');

// Privacy note: this page deliberately does NOT show per-user bill
// names or amounts. Bill names ("Rent to Mike", "Therapist Tuesday")
// are highly personal — admins manage operational health (overdue
// counts, recurrence mix) and never see what an individual user owes.

export default async function BillsAdminPage() {
  await connectDB();
  const overview = await admin.billsOverview();

  const totalBills = overview.counts.upcoming + overview.counts.overdue + overview.counts.paid;
  const recurrenceTotal = Object.values(overview.byRecurrence).reduce((s, v) => s + v, 0);

  return (
    <>
      <Topbar title="Bills" subtitle={`${fmt.format(totalBills)} total · operational view`} />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 animate-fade-in-up">
          <SummaryBox label="Upcoming" value={fmt.format(overview.counts.upcoming)} tone="brand" />
          <SummaryBox label="Overdue" value={fmt.format(overview.counts.overdue)} tone="rose" />
          <SummaryBox label="Paid" value={fmt.format(overview.counts.paid)} tone="emerald" />
          <SummaryBox label="Due this week" value={fmt.format(overview.dueThisWeek)} tone="amber" />
        </div>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Active bills by recurrence</h2>
          {recurrenceTotal === 0 ? (
            <p className="text-sm text-slate-500">No active bills yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(overview.byRecurrence).map(([r, count]) => (
                <span key={r} className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm">
                  <span className="font-semibold capitalize">{r === 'none' ? 'One-off' : r}</span>{' '}
                  <span className="text-slate-500">· {fmt.format(count)}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900">Privacy</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-3xl">
            Per the Play Store privacy policy, admins manage operational health and never see
            individual users&apos; bill names, amounts, or accounts. Use{' '}
            <code className="text-[11px] bg-slate-100 px-1 rounded">/admin/users</code> for
            lifecycle changes; everything billing-related is aggregate-only.
          </p>
        </section>
      </main>
    </>
  );
}

function SummaryBox({ label, value, tone }) {
  const tones = {
    brand:   'from-brand-500/15 to-brand-500/0 ring-brand-200 text-brand-700',
    emerald: 'from-emerald-500/15 to-emerald-500/0 ring-emerald-200 text-emerald-700',
    rose:    'from-rose-500/15 to-rose-500/0 ring-rose-200 text-rose-700',
    amber:   'from-amber-500/15 to-amber-500/0 ring-amber-200 text-amber-700',
  };
  const t = tones[tone] || tones.brand;
  return (
    <div className={`rounded-xl ring-1 bg-gradient-to-br px-4 py-4 ${t}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</div>
    </div>
  );
}
