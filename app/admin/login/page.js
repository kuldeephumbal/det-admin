'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import Toast from '@/components/admin/Toast';

export default function AdminLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setToast(null);
    try {
      const r = await fetch('/api/v1/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok) {
        setToast({ kind: 'error', message: friendlyError(r.status, json?.error) });
        return;
      }
      setToast({ kind: 'success', message: 'Signed in. Taking you to the dashboard…' });
      setTimeout(() => {
        router.replace(next);
        router.refresh();
      }, 500);
    } catch (_err) {
      setToast({
        kind: 'error',
        message: 'Could not reach the server. Check your connection and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 bg-slate-50 overflow-hidden">
      {/* Decorative gradient background */}
      <div aria-hidden="true" className="absolute inset-0 bg-mesh-light pointer-events-none" />
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full
                   bg-gradient-to-br from-brand-500/30 to-violet-500/10 blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full
                   bg-gradient-to-br from-violet-500/25 to-sky-500/10 blur-3xl pointer-events-none"
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Top brand row */}
        <div className="flex items-center justify-center gap-2.5 mb-7">
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600
                          grid place-items-center font-bold text-white text-lg shadow-glow-brand">
            D
            <span className="absolute inset-0 rounded-2xl shadow-inner-soft" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-slate-900 text-lg tracking-tight">DET</div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500">Admin Panel</div>
          </div>
        </div>

        {/* Glass card */}
        <form
          onSubmit={submit}
          className="relative bg-white/85 backdrop-blur-xl border border-white/60 ring-1 ring-slate-200/60
                     rounded-3xl shadow-card-deep p-7 sm:p-8"
        >
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tightest">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to continue to the admin panel.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                     className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
                             placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                     className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm
                             placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 btn-primary py-3"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
                  <polyline points="12 5 19 12 12 19" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
          </button>

          <p className="mt-5 text-center text-xs text-slate-500">
            Protected area. All activity is logged.
          </p>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} DET · Daily Expense Tracker
        </p>
      </div>
    </main>
  );
}

function friendlyError(status, error) {
  const code = error?.code;
  const raw = error?.message;

  if (code === 'SERVICE_UNAVAILABLE' || status === 503) {
    return "Can't reach the database right now. Please try again in a moment.";
  }
  if (status === 401) return 'Invalid email or password.';
  if (status === 403) {
    if (raw && /not an admin/i.test(raw)) return 'This account is not an admin.';
    return raw || 'Access denied.';
  }
  if (status === 422) {
    const first = Array.isArray(error?.details) && error.details[0];
    return first?.message || 'Please check the fields and try again.';
  }
  if (status === 429) return 'Too many attempts — wait a minute and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return raw || 'Sign in failed.';
}
