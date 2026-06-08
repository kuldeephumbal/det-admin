'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAdminLayout } from './AdminShell';

export default function Topbar({ title, subtitle }) {
  const router = useRouter();
  const { openSidebar } = useAdminLayout();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch('/api/v1/admin/session', { method: 'DELETE' });
    } catch (_) {}
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/70 supports-[backdrop-filter]:bg-white/60">
      <div className="px-4 lg:px-8 py-3.5 lg:py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={openSidebar}
          className="lg:hidden -ml-1 p-2 rounded-lg text-slate-700 hover:bg-slate-100/80 transition"
          aria-label="Open menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
            <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" />
            <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" />
            <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl lg:text-[22px] font-bold text-slate-900 leading-tight truncate tracking-tightest">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden sm:block text-xs lg:text-sm text-slate-500 truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Help"
            className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-xl
                       text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 transition"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
            </svg>
          </button>

          <button
            onClick={signOut}
            disabled={signingOut}
            className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl
                       text-sm font-medium text-slate-700
                       border border-slate-200 bg-white
                       hover:bg-slate-50 hover:border-slate-300
                       transition-colors disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="16 17 21 12 16 7" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="21" y1="12" x2="9" y2="12" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
