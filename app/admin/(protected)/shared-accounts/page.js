import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';
const fmt = new Intl.NumberFormat('en-IN');

// Privacy note: per-pair invitations, inviter/invitee emails, and the
// per-account membership rosters are never surfaced here. This page is
// aggregate-only — same policy as /admin/accounts.

const statusLabel = {
  pending: 'Pending',
  active: 'Active',
  declined: 'Declined',
  revoked: 'Revoked',
};

const statusTone = {
  pending: 'amber',
  active: 'emerald',
  declined: 'slate',
  revoked: 'rose',
};

export default async function SharedAccountsAdminPage() {
  await connectDB();
  const overview = await admin.sharedAccountsOverview();
  const statusEntries = Object.entries(overview.byStatus);

  return (
    <>
      <Topbar
        title="Shared accounts"
        subtitle="Aggregate-only · per Play Store privacy policy"
      />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 animate-fade-in-up">
          <SummaryBox
            label="Shared accounts"
            value={fmt.format(overview.sharedAccounts)}
            tone="brand"
          />
          <SummaryBox
            label="Active members"
            value={fmt.format(overview.byStatus.active || 0)}
            tone="emerald"
          />
          <SummaryBox
            label="Avg members / shared"
            value={overview.avgMembersPerSharedAccount}
            tone="slate"
          />
          <SummaryBox
            label="Stale pending (>14d)"
            value={fmt.format(overview.stalePendingCount)}
            tone={overview.stalePendingCount > 0 ? 'amber' : 'slate'}
          />
        </div>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Invitations by status</h2>
          {statusEntries.every(([, n]) => n === 0) ? (
            <p className="text-sm text-slate-500">No invitations yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {statusEntries.map(([status, count]) => (
                <Pill
                  key={status}
                  label={statusLabel[status] || status}
                  count={count}
                  tone={statusTone[status] || 'slate'}
                />
              ))}
            </div>
          )}
        </section>

        <section className="surface p-5 lg:p-6 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Why this page exists</h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
            Sharing is a premium-funnel signal — high active-member counts mean
            the feature is sticky, while many stale-pending rows hint that
            invitee onboarding has friction. Admins see only counts, never the
            email addresses or account names involved.
          </p>
        </section>
      </main>
    </>
  );
}

function SummaryBox({ label, value, tone }) {
  const tones = {
    brand: 'from-brand-500/15 to-brand-500/0 ring-brand-200 text-brand-700',
    emerald: 'from-emerald-500/15 to-emerald-500/0 ring-emerald-200 text-emerald-700',
    amber: 'from-amber-500/15 to-amber-500/0 ring-amber-200 text-amber-700',
    rose: 'from-rose-500/15 to-rose-500/0 ring-rose-200 text-rose-700',
    slate: 'from-slate-500/15 to-slate-500/0 ring-slate-200 text-slate-700',
  };
  const t = tones[tone] || tones.slate;
  return (
    <div className={`rounded-xl ring-1 bg-gradient-to-br px-4 py-4 ${t}`}>
      <div className="text-[10px] uppercase font-semibold tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</div>
    </div>
  );
}

function Pill({ label, count, tone }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  const t = tones[tone] || tones.slate;
  return (
    <span className={`px-3 py-1.5 rounded-full text-sm ${t}`}>
      <span className="font-semibold">{label}</span>{' '}
      <span className="opacity-70">· {fmt.format(count)}</span>
    </span>
  );
}
