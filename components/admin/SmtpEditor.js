'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/// Full SMTP editor. Server page hydrates this with the current
/// effective config + a passwordHint. The form PUTs to
/// /api/v1/admin/settings/smtp; password is optional on edits so
/// admins can change host/port/user without retyping it.
export default function SmtpEditor({ initial }) {
  const router = useRouter();
  const [form, setForm] = useState({
    host: initial.host || '',
    port: String(initial.port || 587),
    user: initial.user || '',
    password: '',
    from: initial.from || '',
  });
  const [touchedPwd, setTouchedPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const payload = {
        host: form.host.trim(),
        port: parseInt(form.port, 10) || 587,
        user: form.user.trim(),
        from: form.from.trim(),
      };
      // Only send password when the user explicitly typed in the field.
      if (touchedPwd) payload.password = form.password;

      const res = await fetch('/api/v1/admin/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        setResult({
          kind: 'error',
          text: body?.error?.message || `Save failed (${res.status})`,
          details: body?.error?.details,
        });
        return;
      }
      setResult({ kind: 'success', text: 'Saved. Mailer reloaded with the new credentials.' });
      setForm((f) => ({ ...f, password: '' }));
      setTouchedPwd(false);
      router.refresh();
    } catch (err) {
      setResult({ kind: 'error', text: err.message || 'Network error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Host"
          hint="e.g. smtp.gmail.com or smtp.sendgrid.net"
          value={form.host}
          onChange={update('host')}
          required
          placeholder="smtp.example.com"
        />
        <Field
          label="Port"
          hint="465 for TLS, 587 for STARTTLS"
          value={form.port}
          onChange={update('port')}
          required
          type="number"
          min="1"
          max="65535"
          placeholder="587"
        />
        <Field
          label="Username"
          hint="Usually the email address or SMTP user id"
          value={form.user}
          onChange={update('user')}
          required
          placeholder="you@example.com"
        />
        <Field
          label="Password / API key"
          hint={
            initial.passwordSet
              ? `Current: ${initial.passwordHint || '•••• (saved)'} — leave blank to keep`
              : 'Required on first setup'
          }
          value={form.password}
          onChange={(e) => {
            setTouchedPwd(true);
            update('password')(e);
          }}
          type="password"
          autoComplete="new-password"
          placeholder={initial.passwordSet ? '•••• (saved)' : 'Enter SMTP password'}
        />
        <div className="md:col-span-2">
          <Field
            label="From address"
            hint='Displayed in the recipient inbox. e.g. "DET &lt;no-reply@det.app&gt;"'
            value={form.from}
            onChange={update('from')}
            required
            placeholder='DET <no-reply@yourdomain.com>'
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {busy ? 'Saving…' : 'Save settings'}
        </button>
        {initial.source === 'db' && (
          <span className="text-xs text-slate-500">
            Saved in DB — overrides any matching env variables.
          </span>
        )}
        {initial.source === 'env' && initial.host && (
          <span className="text-xs text-slate-500">
            Currently loaded from environment variables. Saving here will start overriding them.
          </span>
        )}
      </div>

      {result && (
        <div
          className={[
            'text-sm px-3 py-2 rounded-lg',
            result.kind === 'success' && 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
            result.kind === 'error' && 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div>{result.text}</div>
          {Array.isArray(result.details) && result.details.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-xs">
              {result.details.map((d, i) => (
                <li key={i}>{d.field}: {d.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

function Field({ label, hint, ...rest }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700 font-medium">{label}</span>
      <input
        {...rest}
        className="mt-1 w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-card focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition"
      />
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}
