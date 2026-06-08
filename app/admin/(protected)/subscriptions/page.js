import StatusPill from '@/components/admin/StatusPill';
import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const fmtMoney = (v, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(v || 0);

export default async function SubscriptionsPage({ searchParams }) {
  await connectDB();
  const sp = (await searchParams) || {};
  const page = parseInt(sp.page, 10) || 1;
  const plan = sp.plan ? String(sp.plan) : undefined;
  const status = sp.status ? String(sp.status) : undefined;

  const result = await admin.listSubscriptions({ page, limit: PAGE_SIZE, plan, status });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <>
      <Topbar title="Subscriptions" subtitle={`${result.total} total`} />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <form className="flex flex-wrap items-center gap-2 animate-fade-in-up">
          <select
            name="plan"
            defaultValue={plan || ''}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-card
                       focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition"
          >
            <option value="">All plans</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
          <select
            name="status"
            defaultValue={status || ''}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-card
                       focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
          <button type="submit" className="btn-primary">Apply</button>
        </form>

        <section className="surface overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-slate-50/60 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">User</th>
                  <th className="text-left px-4 py-3 font-semibold">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Cycle</th>
                  <th className="text-left px-4 py-3 font-semibold">Price</th>
                  <th className="text-left px-4 py-3 font-semibold">Renews</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-400">No subscriptions match.</td></tr>
                ) : result.items.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 lg:px-6 py-3.5">
                      {s.user ? (
                        <>
                          <div className="font-semibold text-slate-900">{s.user.name}</div>
                          <div className="text-xs text-slate-500">{s.user.email}</div>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5"><StatusPill value={s.plan} /></td>
                    <td className="px-4 py-3.5"><StatusPill value={s.status} /></td>
                    <td className="px-4 py-3.5 text-slate-700 capitalize">{s.billingCycle}</td>
                    <td className="px-4 py-3.5 text-slate-700">{s.price ? fmtMoney(s.price, s.currency) : 'Free'}</td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 lg:px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <a
                  href={`?page=${Math.max(1, page - 1)}${plan ? `&plan=${plan}` : ''}${status ? `&status=${status}` : ''}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white ${page <= 1 ? 'text-slate-300 pointer-events-none' : 'text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition'}`}
                >
                  Prev
                </a>
                <a
                  href={`?page=${Math.min(totalPages, page + 1)}${plan ? `&plan=${plan}` : ''}${status ? `&status=${status}` : ''}`}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white ${page >= totalPages ? 'text-slate-300 pointer-events-none' : 'text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition'}`}
                >
                  Next
                </a>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
