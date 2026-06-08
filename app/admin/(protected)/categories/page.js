import CategoryEditor from '@/components/admin/CategoryEditor';
import Topbar from '@/components/admin/Topbar';
import admin from '@/lib/services/admin.service';
import connectDB from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DefaultCategoriesPage() {
  await connectDB();
  const items = await admin.listDefaultCategories();

  return (
    <>
      <Topbar title="Default categories" subtitle="Seeded for every user" />
      <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
        <div className="flex items-center justify-between animate-fade-in-up">
          <p className="text-sm text-slate-500">
            {items.length} default {items.length === 1 ? 'category' : 'categories'} available to every user.
          </p>
          <CategoryEditor />
        </div>

        <section className="surface overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-slate-50/60 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 lg:px-6 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Icon</th>
                  <th className="text-left px-4 py-3 font-semibold">Color</th>
                  <th className="text-left px-4 py-3 font-semibold">Active</th>
                  <th className="text-right px-5 lg:px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-14 text-center text-slate-400">No defaults yet — run npm run seed.</td></tr>
                ) : items.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 lg:px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-8 h-8 rounded-lg grid place-items-center text-white text-sm font-semibold shadow-inner-soft"
                          style={{ background: c.color }}
                        >
                          {c.name.slice(0, 1)}
                        </span>
                        <span className="font-semibold text-slate-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600">{c.icon}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full ring-1 ring-slate-200" style={{ backgroundColor: c.color }} />
                        <span className="font-mono text-xs text-slate-600">{c.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {c.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 lg:px-6 py-3.5 text-right">
                      <CategoryEditor existing={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
