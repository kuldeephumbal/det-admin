import StatusPill from '@/components/admin/StatusPill';
import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;

export default async function SmsRulesAdminPage({ searchParams }) {
  await connectDB();
  const sp = (await searchParams) || {};
  const page = parseInt(sp.page, 10) || 1;

  const result = await admin.listSmsRules({ page, limit: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <>
      <Topbar title="SMS parser rules" subtitle={`${result.total} total`} />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="surface p-5 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900">How this works</h2>
          <p className="text-sm text-slate-500 mt-2 leading-6">
            Rules listed here are served via <code className="text-xs bg-slate-100 px-1 rounded">GET /api/v1/sms-rules</code> to
            every Android client. The phone's background isolate matches incoming SMSes against these regexes locally — bodies never leave the device.
            Use <code className="text-xs bg-slate-100 px-1 rounded">POST /api/v1/admin/sms-rules</code> to create new entries (full editor UI is on the roadmap).
          </p>
        </div>

        <section className="surface overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-slate-50/60 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Bank</th>
                  <th className="text-left px-4 py-3 font-semibold">Sender pattern</th>
                  <th className="text-left px-4 py-3 font-semibold">Amount regex</th>
                  <th className="text-left px-4 py-3 font-semibold">Currency</th>
                  <th className="text-left px-4 py-3 font-semibold">v</th>
                  <th className="text-left px-4 py-3 font-semibold">Active</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-14 text-center text-slate-400">No rules seeded yet.</td></tr>
                ) : result.items.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors align-top">
                    <td className="px-5 lg:px-6 py-3.5 font-semibold text-slate-900">{r.name}</td>
                    <td className="px-4 py-3.5 text-slate-600">{r.bankName || '—'}</td>
                    <td className="px-4 py-3.5"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded break-all">{r.senderPattern}</code></td>
                    <td className="px-4 py-3.5"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded break-all">{r.amountRegex}</code></td>
                    <td className="px-4 py-3.5 text-slate-700">{r.currency}</td>
                    <td className="px-4 py-3.5 text-slate-500">{r.version}</td>
                    <td className="px-4 py-3.5"><StatusPill value={r.isActive ? 'active' : 'inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-5 lg:px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
              <span className="text-slate-500">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <a href={`?page=${Math.max(1, page - 1)}`}
                   className={`px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white ${page <= 1 ? 'text-slate-300 pointer-events-none' : 'text-slate-700 hover:bg-slate-50'}`}>Prev</a>
                <a href={`?page=${Math.min(totalPages, page + 1)}`}
                   className={`px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 bg-white ${page >= totalPages ? 'text-slate-300 pointer-events-none' : 'text-slate-700 hover:bg-slate-50'}`}>Next</a>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
