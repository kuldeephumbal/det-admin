import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-IN');

// Privacy note: insight titles + narrated bodies are personalised
// analysis of a user's finances. Admins see cost / volume aggregates
// and severity distribution only — never the per-user prose.

export default async function InsightsAdminPage() {
  await connectDB();
  const overview = await admin.insightsOverview();
  const maxTokens = Math.max(1, ...overview.daily.map((d) => d.tokens));
  const severityTotal = Object.values(overview.severity).reduce((s, v) => s + v, 0);

  return (
    <>
      <Topbar
        title="Insights"
        subtitle={`${fmt.format(overview.totals.totalInsights)} generated · ${fmt.format(overview.totals.totalTokens)} tokens`}
      />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 animate-fade-in-up">
          <SummaryBox label="Total generated" value={fmt.format(overview.totals.totalInsights)} tone="brand" />
          <SummaryBox label="LLM tokens used" value={fmt.format(overview.totals.totalTokens)} tone="violet" />
          <SummaryBox label="Canned narrations" value={fmt.format(overview.totals.cannedCount)} tone="slate" />
        </div>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Daily generation (last 30 days)</h2>
          {overview.daily.length === 0 ? (
            <p className="text-sm text-slate-500">No insights generated in the last 30 days.</p>
          ) : (
            <div className="flex items-end gap-1 h-40">
              {overview.daily.map((d) => {
                const pct = (d.tokens / maxTokens) * 100;
                return (
                  <div
                    key={d.date}
                    className="flex-1 min-w-[6px] rounded-t bg-gradient-to-t from-brand-500 to-violet-500 opacity-90"
                    style={{ height: `${Math.max(4, pct)}%` }}
                    title={`${d.date} — ${d.count} insights · ${fmt.format(d.tokens)} tokens`}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">By severity</h2>
          {severityTotal === 0 ? (
            <p className="text-sm text-slate-500">No insights yet.</p>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              <SevBox label="Info" value={overview.severity.info} tone="slate" />
              <SevBox label="Low" value={overview.severity.low} tone="sky" />
              <SevBox label="Medium" value={overview.severity.medium} tone="amber" />
              <SevBox label="High" value={overview.severity.high} tone="rose" />
            </div>
          )}
        </section>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900">Privacy</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-3xl">
            Insight titles and bodies are personalised analysis of a user&apos;s spending —
            often very specific (&quot;Your dining spend doubled this month&quot;). They are
            never shown to admins. The cost / volume aggregates here are what we use to
            monitor LLM spend and detector tuning.
          </p>
        </section>
      </main>
    </>
  );
}

function SummaryBox({ label, value, tone }) {
  const tones = {
    brand:  'from-brand-500/15 to-brand-500/0 ring-brand-200 text-brand-700',
    violet: 'from-violet-500/15 to-violet-500/0 ring-violet-200 text-violet-700',
    slate:  'from-slate-500/15 to-slate-500/0 ring-slate-200 text-slate-700',
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-xl ring-1 bg-gradient-to-br px-4 py-4 ${t}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</div>
    </div>
  );
}

function SevBox({ label, value, tone }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    sky:   'bg-sky-100 text-sky-700',
    amber: 'bg-amber-100 text-amber-700',
    rose:  'bg-rose-100 text-rose-700',
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-lg px-3 py-3 ${t}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-xl font-bold mt-1 tracking-tight">{new Intl.NumberFormat('en-IN').format(value)}</div>
    </div>
  );
}
