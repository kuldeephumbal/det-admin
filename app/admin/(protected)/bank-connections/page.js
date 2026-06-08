import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-IN');

// Privacy note: per-user bank names and account masks are financial
// PII. Admins see aggregate provider + status distribution and a count
// of connections that need attention — never which user is connected
// where.

export default async function BankConnectionsAdminPage() {
  await connectDB();
  const overview = await admin.bankConnectionsOverview();
  const providerEntries = Object.entries(overview.byProvider);
  const total = Object.values(overview.byStatus).reduce((s, v) => s + v, 0);

  return (
    <>
      <Topbar title="Bank connections" subtitle={`${fmt.format(total)} total · aggregate view`} />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 animate-fade-in-up">
          <SummaryBox label="Active" value={fmt.format(overview.byStatus.active)} tone="emerald" />
          <SummaryBox label="Re-auth req'd" value={fmt.format(overview.byStatus.requires_reauth)} tone="amber" />
          <SummaryBox label="Disconnected" value={fmt.format(overview.byStatus.disconnected)} tone="slate" />
          <SummaryBox label="Errored" value={fmt.format(overview.byStatus.error)} tone="rose" />
        </div>

        {overview.needsAttention > 0 && (
          <section className="surface p-5 lg:p-6 animate-fade-in-up ring-1 ring-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {fmt.format(overview.needsAttention)} active connection(s) have errors or haven&apos;t synced in &gt; 2 days.
                </p>
              </div>
            </div>
          </section>
        )}

        {providerEntries.length > 0 && (
          <section className="surface p-5 lg:p-6 animate-fade-in-up">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">By provider</h2>
            <div className="flex flex-wrap gap-2">
              {providerEntries.map(([provider, count]) => (
                <span key={provider} className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm">
                  <span className="font-semibold capitalize">{provider}</span>{' '}
                  <span className="text-slate-500">· {fmt.format(count)}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900">Privacy</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-3xl">
            Bank names and account last-4s belong to the user. Admins manage operational
            health here — provider mix, error count, and whether anything needs a re-auth
            sweep. To act on a specific user&apos;s connection, route through{' '}
            <code className="text-[11px] bg-slate-100 px-1 rounded">/admin/users</code>{' '}
            with their consent.
          </p>
        </section>
      </main>
    </>
  );
}

function SummaryBox({ label, value, tone }) {
  const tones = {
    emerald: 'from-emerald-500/15 to-emerald-500/0 ring-emerald-200 text-emerald-700',
    amber:   'from-amber-500/15 to-amber-500/0 ring-amber-200 text-amber-700',
    slate:   'from-slate-500/15 to-slate-500/0 ring-slate-200 text-slate-700',
    rose:    'from-rose-500/15 to-rose-500/0 ring-rose-200 text-rose-700',
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-xl ring-1 bg-gradient-to-br px-4 py-4 ${t}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</div>
    </div>
  );
}
