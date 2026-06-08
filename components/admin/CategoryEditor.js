'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const PALETTE = [
  '#FF7043', '#FFA726', '#FFCA28', '#66BB6A', '#26A69A', '#26C6DA',
  '#42A5F5', '#5C6BC0', '#AB47BC', '#EC407A', '#EF5350', '#8D6E63', '#78909C',
];
const ICONS = [
  'restaurant', 'fastfood', 'local_cafe', 'local_grocery_store',
  'flight', 'directions_car', 'train', 'shopping_bag', 'shopping_cart', 'store',
  'receipt_long', 'bolt', 'water_drop', 'wifi', 'home', 'phone_iphone',
  'favorite', 'local_hospital', 'medication', 'fitness_center',
  'school', 'menu_book', 'computer', 'movie', 'sports_esports', 'music_note',
  'beach_access', 'pets', 'savings', 'payments', 'category',
];

export default function CategoryEditor({ existing }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existing?.name || '');
  const [icon, setIcon] = useState(existing?.icon || 'category');
  const [color, setColor] = useState(existing?.color || '#6366f1');
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const isEdit = !!existing;

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const url = isEdit ? `/api/v1/admin/categories/${existing.id}` : '/api/v1/admin/categories';
      const method = isEdit ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), icon, color }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        alert(j?.error?.message || 'Failed');
        return;
      }
      setOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${existing.name}"? Users who picked from defaults won't see it anymore.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/admin/categories/${existing.id}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        alert(j?.error?.message || 'Failed');
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className={isEdit ? 'btn-ghost text-xs px-2.5 py-1.5' : 'btn-primary'}
        >
          {isEdit ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
                <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
              </svg>
              New category
            </>
          )}
        </button>
        {isEdit && (
          <button
            disabled={busy}
            onClick={remove}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                       text-rose-700 ring-1 ring-rose-200 bg-rose-50/60
                       hover:bg-rose-100/70 hover:ring-rose-300 transition
                       disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-3.5 h-3.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
            </svg>
            Delete
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-30 grid place-items-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-card-deep border border-slate-200 animate-scale-in overflow-hidden">
            {/* Preview header */}
            <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl grid place-items-center font-bold text-white text-lg shadow-inner-soft"
                  style={{ background: color }}
                >
                  {name.slice(0, 1).toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-slate-900 truncate">
                    {name || (isEdit ? 'Edit category' : 'New category')}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">{icon}</div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="ml-auto p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-5 py-5 space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition"
                  placeholder="Groceries, Fuel…"
                  autoFocus
                />
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Color</div>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map((c) => {
                    const active = c.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setColor(c)}
                        className={`relative w-8 h-8 rounded-full transition-all duration-150
                                    ${active ? 'scale-110 ring-2 ring-offset-2 ring-slate-900' : 'hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                        aria-label={c}
                      >
                        {active && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"
                               className="absolute inset-0 m-auto w-4 h-4">
                            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Icon</div>
                <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-auto p-1 -m-1">
                  {ICONS.map((n) => {
                    const active = n === icon;
                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => setIcon(n)}
                        className={`h-10 rounded-lg text-[10px] font-semibold transition-all duration-150
                                    ${active
                                      ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-500 scale-105'
                                      : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 hover:scale-105'}`}
                        title={n}
                      >
                        {n.split('_')[0].slice(0, 4)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/40 flex items-center justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                disabled={busy || !name.trim()}
                onClick={submit}
                className="btn-primary"
              >
                {busy ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Saving…
                  </>
                ) : (isEdit ? 'Save changes' : 'Create category')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
