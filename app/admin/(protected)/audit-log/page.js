import Topbar from '@/components/admin/Topbar';
import audit from '@/lib/services/audit.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

const ACTION_TONES = {
  'user.updateStatus':       'bg-amber-50 text-amber-800 ring-amber-200/70',
  'category.create':         'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  'category.update':         'bg-sky-50 text-sky-700 ring-sky-200/70',
  'category.delete':         'bg-rose-50 text-rose-700 ring-rose-200/70',
  'notification.broadcast':  'bg-violet-50 text-violet-700 ring-violet-200/70',
};

const fmtTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const previewJson = (val) => {
  if (val == null) return '—';
  if (typeof val === 'string') return val;
  try {
    const s = JSON.stringify(val);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  } catch {
    return String(val);
  }
};

export default async function AuditLogPage({ searchParams }) {
  await connectDB();
  const sp = (await searchParams) || {};
  const page = parseInt(sp.page, 10) || 1;
  const action = (sp.action || '').toString();

  const result = await audit.list({
    page,
    limit: PAGE_SIZE,
    ...(action && { action }),
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <>
      <Topbar title="Audit log" subtitle={`${result.total} entries`} />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        {/* Filter row */}
        <form className="flex flex-col sm:flex-row sm:items-center gap-2 animate-fade-in-up">
          <div className="relative flex-1 sm:max-w-sm">
            <input
              type="text"
              name="action"
              defaultValue={action}
              placeholder="Filter by action — e.g. user.updateStatus"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white shadow-card
                         focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition"
            />
          </div>
          <button type="submit" className="btn-primary">Filter</button>
          {action && (
            <a
              href="/admin/audit-log"
              className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              Clear
            </a>
          )}
        </form>

        <section className="surface overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50/60 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">When</th>
                  <th className="text-left px-4 py-3 font-semibold">Actor</th>
                  <th className="text-left px-4 py-3 font-semibold">Action</th>
                  <th className="text-left px-4 py-3 font-semibold">Target</th>
                  <th className="text-left px-4 py-3 font-semibold">Change</th>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-slate-400">
                      No audit entries{action ? ' match that filter' : ' yet'}.
                    </td>
                  </tr>
                ) : (
                  result.items.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors align-top">
                      <td className="px-5 lg:px-6 py-3.5 text-slate-500 whitespace-nowrap">
                        {fmtTime(row.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{row.actorName || '—'}</div>
                        <div className="text-xs text-slate-500">{row.actorEmail}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <ActionPill action={row.action} />
                      </td>
                      <td className="px-4 py-3.5">
                        {row.targetType ? (
                          <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider">{row.targetType}</div>
                            <code className="text-xs text-slate-700">{row.targetId || '—'}</code>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        {row.before != null || row.after != null ? (
                          <div className="space-y-0.5">
                            {row.before != null && <div><span className="text-slate-400">before</span> {previewJson(row.before)}</div>}
                            {row.after != null && <div><span className="text-emerald-600">after</span> {previewJson(row.after)}</div>}
                          </div>
                        ) : row.meta != null ? (
                          <span className="text-slate-600">{previewJson(row.meta)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 lg:px-6 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {row.ip || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 lg:px-6 py-3 border-t border-slate-100 text-xs text-slate-500">
              <span>Page {result.page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                {result.page > 1 && (
                  <a
                    href={`?${new URLSearchParams({ ...(action && { action }), page: String(result.page - 1) })}`}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                  >
                    ← Previous
                  </a>
                )}
                {result.page < totalPages && (
                  <a
                    href={`?${new URLSearchParams({ ...(action && { action }), page: String(result.page + 1) })}`}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                  >
                    Next →
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function ActionPill({ action }) {
  const tone = ACTION_TONES[action] || 'bg-slate-50 text-slate-700 ring-slate-200';
  return (
    <code className={[
      'inline-flex items-center px-2 py-0.5 rounded-full ring-1',
      'text-[11px] font-semibold',
      tone,
    ].join(' ')}>
      {action}
    </code>
  );
}
