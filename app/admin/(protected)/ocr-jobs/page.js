import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-IN');

// Privacy note: OCR'd receipts contain user financial PII (merchant,
// amount, line items). Admins see queue health + anonymised failure
// signatures, never per-user content.

const fmtLatency = (ms) => {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export default async function OcrJobsPage() {
  await connectDB();
  const overview = await admin.listOcrJobs();
  const total =
    overview.counts.pending +
    overview.counts.processing +
    overview.counts.completed +
    overview.counts.failed;

  return (
    <>
      <Topbar title="OCR jobs" subtitle={`${fmt.format(total)} total · operational view`} />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 animate-fade-in-up">
          <SummaryBox label="Pending" value={fmt.format(overview.counts.pending)} tone="amber" />
          <SummaryBox label="Processing" value={fmt.format(overview.counts.processing)} tone="sky" />
          <SummaryBox label="Completed" value={fmt.format(overview.counts.completed)} tone="emerald" />
          <SummaryBox label="Failed" value={fmt.format(overview.counts.failed)} tone="rose" />
        </div>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Processing latency</h2>
          <p className="text-xs text-slate-500 mb-3">
            Average time from upload to completion (last 7 days, across {fmt.format(overview.sampledCompletions)} completions)
          </p>
          <p className="text-3xl font-bold text-slate-900 tracking-tight">
            {fmtLatency(overview.avgLatencyMs)}
          </p>
        </section>

        <section className="surface overflow-hidden animate-fade-in-up">
          <div className="px-5 lg:px-6 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Recent failure signatures</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Grouped by error message (last 7 days). Surfaces flaky providers or rotated keys
              without exposing which user uploaded what.
            </p>
          </div>
          {overview.recentFailures.length === 0 ? (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              No failures in the window 🎉
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50/60 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">Signature</th>
                  <th className="text-right px-5 lg:px-6 py-3 font-semibold w-24">Count</th>
                </tr>
              </thead>
              <tbody>
                {overview.recentFailures.map((f, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-5 lg:px-6 py-3 text-slate-700 font-mono text-xs break-all">
                      {f.signature || '(empty)'}
                    </td>
                    <td className="px-5 lg:px-6 py-3 text-right font-semibold text-slate-900">
                      {fmt.format(f.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900">Privacy</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-3xl">
            Receipt images and the merchant / total / line-item fields extracted from them
            are user financial PII. Admins never see them. Failure signatures here are the
            raw provider error string (e.g. &quot;Vision API quota exceeded&quot;) — useful
            for support without identifying any user.
          </p>
        </section>
      </main>
    </>
  );
}

function SummaryBox({ label, value, tone }) {
  const tones = {
    amber:   'from-amber-500/15 to-amber-500/0 ring-amber-200 text-amber-700',
    sky:     'from-sky-500/15 to-sky-500/0 ring-sky-200 text-sky-700',
    emerald: 'from-emerald-500/15 to-emerald-500/0 ring-emerald-200 text-emerald-700',
    rose:    'from-rose-500/15 to-rose-500/0 ring-rose-200 text-rose-700',
  };
  const t = tones[tone] || tones.sky;
  return (
    <div className={`rounded-xl ring-1 bg-gradient-to-br px-4 py-4 ${t}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</div>
    </div>
  );
}
