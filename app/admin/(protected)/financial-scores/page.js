import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function FinancialScoresAdminPage() {
  await connectDB();
  const overview = await admin.financialScoresOverview();
  const maxCount = Math.max(1, ...overview.histogram.map((b) => b.count));

  const periodLabel = overview.period
    ? new Date(overview.period.year, overview.period.month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : null;

  return (
    <>
      <Topbar
        title="Financial health scores"
        subtitle={periodLabel ? `Distribution for ${periodLabel}` : 'No scores computed yet'}
      />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 animate-fade-in-up">
          <SummaryBox label="Users scored" value={overview.totalScored} tone="brand" />
          <SummaryBox label="Average score" value={overview.totalScored ? overview.mean : '—'} tone="emerald" />
        </div>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Score distribution</h2>
          <p className="text-xs text-slate-500 mb-5">Buckets of 10 across the 0–100 score range</p>

          {overview.totalScored === 0 ? (
            <p className="text-sm text-slate-500">No snapshots yet — the monthly cron writes the first batch on the 1st of next month, or call <code className="text-xs bg-slate-100 px-1 rounded">POST /api/v1/financial-score/recompute</code> as a premium user.</p>
          ) : (
            <div className="grid grid-cols-10 gap-2 items-end h-44">
              {overview.histogram.map((b) => {
                const pct = (b.count / maxCount) * 100;
                return (
                  <div key={b.range} className="flex flex-col items-center justify-end h-full">
                    <div className="text-[11px] font-bold text-slate-900 mb-1">
                      {b.count > 0 ? b.count : ''}
                    </div>
                    <div
                      className={`w-full rounded-t ${b.count > 0 ? 'bg-gradient-to-t from-emerald-500 to-teal-500' : 'bg-slate-200/70'}`}
                      style={{ height: `${b.count > 0 ? Math.max(10, pct) : 6}%` }}
                    />
                    <div className="text-[10px] text-slate-500 mt-2">{b.range}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function SummaryBox({ label, value, tone }) {
  const tones = {
    brand:   'from-brand-500/15 to-brand-500/0 ring-brand-200 text-brand-700',
    emerald: 'from-emerald-500/15 to-emerald-500/0 ring-emerald-200 text-emerald-700',
  };
  const t = tones[tone] || tones.brand;
  return (
    <div className={`rounded-xl ring-1 bg-gradient-to-br px-4 py-4 ${t}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</div>
    </div>
  );
}
