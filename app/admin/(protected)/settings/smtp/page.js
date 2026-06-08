import SmtpEditor from '@/components/admin/SmtpEditor';
import TestEmailForm from '@/components/admin/TestEmailForm';
import { requireAdmin } from '@/lib/admin/serverAuth';
import connectDB from '@/lib/db';
import settings from '@/lib/services/settings.service';

export const dynamic = 'force-dynamic';

export default async function SmtpSettingsPage() {
  await connectDB();
  const [admin, current] = await Promise.all([requireAdmin(), settings.getSmtpForAdmin()]);

  const configured = current.passwordSet && Boolean(current.host) && Boolean(current.user);

  return (
    <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
      <div
        className={[
          'surface p-4 lg:p-5 flex items-center gap-3 animate-fade-in-up',
          configured ? 'ring-1 ring-emerald-200' : 'ring-1 ring-amber-200',
        ].join(' ')}
      >
        <div
          className={[
            'w-2.5 h-2.5 rounded-full',
            configured
              ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]'
              : 'bg-amber-500',
          ].join(' ')}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">
            {configured ? 'SMTP is configured' : 'SMTP is NOT configured'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {configured
              ? `Mail goes through ${current.host} as ${current.user}. Use the test form below to confirm end-to-end delivery.`
              : 'Fill in the form below — host, port, username, password, and a From address. Until then the mailer falls back to logging.'}
          </div>
        </div>
        <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
          Source: {current.source}
        </span>
      </div>

      <section className="surface p-5 lg:p-6 animate-fade-in-up">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">SMTP credentials</h2>
        <p className="text-xs text-slate-500 mb-4 max-w-2xl">
          Saved here, these values live in the <code className="text-[11px] bg-slate-100 px-1 rounded">app_settings</code> collection
          and override the matching <code className="text-[11px] bg-slate-100 px-1 rounded">SMTP_*</code> environment variables.
          The password is encrypted at rest before it leaves this server.
        </p>
        <SmtpEditor initial={current} />
      </section>

      <section className="surface p-5 lg:p-6 animate-fade-in-up">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Test email</h2>
        <p className="text-xs text-slate-500 mb-4">
          Sends a plain-text test message through the configured mailer. When SMTP isn&apos;t set up,
          the email is written to the server log instead.
        </p>
        <TestEmailForm defaultTo={admin.email} configured={configured} />
      </section>

      {current.envFallback.host && (
        <section className="surface p-5 animate-fade-in-up">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">Environment fallback</h2>
          <p className="text-xs text-slate-500 mb-3">
            These values are loaded from the deployment env. They&apos;re used per-field whenever
            the corresponding DB field is empty.
          </p>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Row k="SMTP_HOST" v={current.envFallback.host || '—'} />
            <Row k="SMTP_PORT" v={String(current.envFallback.port || 587)} />
            <Row k="SMTP_USER" v={current.envFallback.user || '—'} />
            <Row k="SMTP_PASS" v={current.envFallback.passwordSet ? '•••• (set)' : '—'} />
            <Row k="MAIL_FROM" v={current.envFallback.from || '—'} />
          </dl>
        </section>
      )}
    </main>
  );
}

function Row({ k, v }) {
  return (
    <div className="flex gap-2">
      <code className="text-[11px] text-slate-400 w-24 shrink-0">{k}</code>
      <span className="font-mono text-[13px] text-slate-700 break-all">{v}</span>
    </div>
  );
}
