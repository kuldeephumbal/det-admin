'use client';

import { useState } from 'react';

/// Client form for the "Send test email" action on the SMTP settings
/// page. Lives in its own file so the parent server component can
/// stay async without smuggling event handlers into RSC.
export default function TestEmailForm({ defaultTo, configured }) {
  const [to, setTo] = useState(defaultTo || '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!to.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/v1/admin/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim() }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setResult({
          kind: 'error',
          text: body?.error?.message || `Request failed with ${res.status}`,
        });
      } else if (body.data?.delivered) {
        setResult({
          kind: 'success',
          text: `Sent — provider id ${body.data.messageId || '—'}`,
        });
      } else {
        setResult({
          kind: 'warn',
          text:
            body.data?.reason === 'smtp_not_configured'
              ? 'SMTP not configured — the mailer logged the email instead of sending it.'
              : 'Email was queued but no provider id was returned.',
        });
      }
    } catch (err) {
      setResult({ kind: 'error', text: err.message || 'Network error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm">
        <span className="text-slate-700 font-medium">Send test to</span>
        <input
          type="email"
          required
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? 'Sending…' : configured ? 'Send test email' : 'Trigger (log-only — SMTP not set)'}
      </button>
      {result && (
        <div
          className={[
            'text-sm px-3 py-2 rounded-lg',
            result.kind === 'success' && 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
            result.kind === 'warn' && 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
            result.kind === 'error' && 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {result.text}
        </div>
      )}
    </form>
  );
}
