import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-IN');

// Privacy note: per-user counterparty names ("Mike", "Mom"), amounts,
// and settlement timing are sensitive. Admins see type / status
// distribution only — never the per-user roster.

export default async function DebtsAdminPage() {
  await connectDB();
  const overview = await admin.debtsOverview();
  const total = overview.byStatus.outstanding + overview.byStatus.settled;

  return (
    <>
      <Topbar title="Debts" subtitle={`${fmt.format(total)} total · aggregate view`} />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 animate-fade-in-up">
          <SummaryBox label="Outstanding" value={fmt.format(overview.byStatus.outstanding)} tone="rose" />
          <SummaryBox label="Settled" value={fmt.format(overview.byStatus.settled)} tone="emerald" />
          <SummaryBox label="Users with debts" value={fmt.format(overview.usersWithActive)} tone="brand" />
          <SummaryBox label="Avg per user" value={overview.avgActivePerUser} tone="slate" />
        </div>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">By direction</h2>
          {total === 0 ? (
            <p className="text-sm text-slate-500">No debts yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm">
                <span className="font-semibold">Lent</span>{' '}
                <span className="text-slate-500">· {fmt.format(overview.byType.lent)}</span>
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm">
                <span className="font-semibold">Borrowed</span>{' '}
                <span className="text-slate-500">· {fmt.format(overview.byType.borrowed)}</span>
              </span>
            </div>
          )}
        </section>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900">Privacy</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-3xl">
            Counterparty names (often very personal — &quot;Mom&quot;, &quot;Roommate&quot;),
            amounts, and per-user settlement history are user financial PII. Admins see
            type / status distribution only.
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
    slate:   'from-slate-500/15 to-slate-500/0 ring-slate-200 text-slate-700',
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-xl ring-1 bg-gradient-to-br px-4 py-4 ${t}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</div>
    </div>
  );
}
