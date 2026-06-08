import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-IN');

// Privacy note: per-user goal names, target amounts, and progress are
// personal data. This page surfaces status distribution and pool-wide
// average progress only.

export default async function SavingsGoalsPage() {
  await connectDB();
  const overview = await admin.listSavingsGoalsOverview();
  const total = overview.counts.active + overview.counts.completed + overview.counts.abandoned;

  return (
    <>
      <Topbar title="Savings goals" subtitle={`${fmt.format(total)} total · aggregate view`} />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 animate-fade-in-up">
          <SummaryBox label="Active" value={fmt.format(overview.counts.active)} tone="emerald" />
          <SummaryBox label="Completed" value={fmt.format(overview.counts.completed)} tone="sky" />
          <SummaryBox label="Abandoned" value={fmt.format(overview.counts.abandoned)} tone="slate" />
          <SummaryBox
            label="Avg progress"
            value={`${overview.avgProgressPct}%`}
            tone="brand"
          />
        </div>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900">Privacy</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-3xl">
            Goal names (often personal — &quot;Down payment&quot;, &quot;Mom&apos;s gift&quot;),
            target amounts, and progress are user financial data. This view shows status
            distribution and an anonymised average across active goals only.
          </p>
        </section>
      </main>
    </>
  );
}

function SummaryBox({ label, value, tone }) {
  const tones = {
    emerald: 'from-emerald-500/15 to-emerald-500/0 ring-emerald-200 text-emerald-700',
    sky:     'from-sky-500/15 to-sky-500/0 ring-sky-200 text-sky-700',
    slate:   'from-slate-500/15 to-slate-500/0 ring-slate-200 text-slate-700',
    brand:   'from-brand-500/15 to-brand-500/0 ring-brand-200 text-brand-700',
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-xl ring-1 bg-gradient-to-br px-4 py-4 ${t}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</div>
    </div>
  );
}
