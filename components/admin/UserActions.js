'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function UserActions({ user }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        alert(j?.error?.message || 'Failed');
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setBusy(false);
    }
  };

  if (user.role === 'admin') {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {user.status === 'blocked' ? (
        <button
          disabled={busy}
          onClick={() => setStatus('active')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                     text-emerald-700 ring-1 ring-emerald-200 bg-emerald-50/60
                     hover:bg-emerald-100/70 hover:ring-emerald-300 transition
                     disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Activate
        </button>
      ) : (
        <button
          disabled={busy}
          onClick={() => setStatus('blocked')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                     text-rose-700 ring-1 ring-rose-200 bg-rose-50/60
                     hover:bg-rose-100/70 hover:ring-rose-300 transition
                     disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" strokeLinecap="round" />
          </svg>
          Block
        </button>
      )}
    </div>
  );
}
