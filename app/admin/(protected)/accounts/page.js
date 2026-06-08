import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-IN');

const typeLabel = (t) => ({
  cash: 'Cash',
  bank: 'Bank',
  credit_card: 'Credit card',
  wallet: 'Wallet',
  savings: 'Savings',
  loan: 'Loan',
}[t] || t);

// Privacy note: per-user account names, masks, and balances are
// financial PII and never appear here. This page is aggregate-only.

export default async function AccountsAdminPage() {
  await connectDB();
  const overview = await admin.accountsOverview();
  const typeEntries = Object.entries(overview.byType);

  return (
    <>
      <Topbar title="Accounts" subtitle="Aggregate-only · per Play Store privacy policy" />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 animate-fade-in-up">
          <SummaryBox label="Active accounts" value={fmt.format(overview.totalAccounts)} tone="brand" />
          <SummaryBox label="Users with accounts" value={fmt.format(overview.usersWithAccounts)} tone="emerald" />
          <SummaryBox label="Avg per user" value={overview.avgPerUser} tone="slate" />
          <SummaryBox label="Archived" value={fmt.format(overview.archivedCount)} tone="slate" />
        </div>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">By type</h2>
          {typeEntries.length === 0 ? (
            <p className="text-sm text-slate-500">No accounts yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {typeEntries.map(([t, count]) => (
                <span key={t} className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm">
                  <span className="font-semibold">{typeLabel(t)}</span>{' '}
                  <span className="text-slate-500">· {fmt.format(count)}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900">Privacy</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-3xl">
            Individual user account names, last-4 masks, and balances are not surfaced to
            the admin panel. Aggregate counts are enough to monitor adoption — anything
            user-specific is a privacy violation under our Play Store policy.
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
