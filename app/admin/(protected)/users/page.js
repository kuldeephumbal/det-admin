import StatusPill from '@/components/admin/StatusPill';
import Topbar from '@/components/admin/Topbar';
import UserActions from '@/components/admin/UserActions';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const PALETTE = [
  'from-brand-500 to-violet-600',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-amber-400 to-orange-500',
];
const initialGradient = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
};

export default async function UsersPage({ searchParams }) {
  await connectDB();
  const sp = (await searchParams) || {};
  const page = parseInt(sp.page, 10) || 1;
  const q = (sp.q || '').toString();

  const result = await admin.listUsers({ page, limit: PAGE_SIZE, q: q || undefined });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <>
      <Topbar title="Users" subtitle={`${result.total} total`} />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <form className="flex flex-col sm:flex-row sm:items-center gap-2 animate-fade-in-up">
          <div className="relative flex-1 sm:max-w-md">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white shadow-card
                         focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition"
            />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>

        <section className="surface overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-slate-50/60 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">User</th>
                  <th className="text-left px-4 py-3 font-semibold">Role</th>
                  <th className="text-left px-4 py-3 font-semibold">Plan</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Last login</th>
                  <th className="text-left px-4 py-3 font-semibold">Joined</th>
                  <th className="text-right px-5 lg:px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-14 text-center text-slate-400">No users match.</td></tr>
                ) : result.items.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 lg:px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${initialGradient(u.name)}
                                         grid place-items-center font-bold text-white text-sm shadow-inner-soft`}>
                          {u.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{u.name}</div>
                          <div className="text-xs text-slate-500 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><StatusPill value={u.role} /></td>
                    <td className="px-4 py-3.5"><StatusPill value={u.plan} /></td>
                    <td className="px-4 py-3.5"><StatusPill value={u.status} /></td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 lg:px-6 py-3.5 text-right">
                      <UserActions user={u} />
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
                <PageLink page={page - 1} q={q} disabled={page <= 1}>Prev</PageLink>
                <PageLink page={page + 1} q={q} disabled={page >= totalPages}>Next</PageLink>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function PageLink({ page, q, disabled, children }) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  if (q) params.set('q', q);
  const href = `?${params.toString()}`;
  if (disabled) {
    return <span className="px-3 py-1.5 rounded-lg text-sm text-slate-300 cursor-not-allowed">{children}</span>;
  }
  return (
    <a href={href} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition">
      {children}
    </a>
  );
}
