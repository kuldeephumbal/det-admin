import Link from 'next/link';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  {
    href: '/admin/settings/smtp',
    title: 'Email (SMTP)',
    blurb: 'Outgoing mail server used for verification, password reset, and admin notifications.',
    icon: IconMail,
    ready: true,
  },
  {
    href: '/admin/settings/push',
    title: 'Push (FCM)',
    blurb: 'Firebase Cloud Messaging credentials and per-user device caps.',
    icon: IconBell,
    ready: false,
  },
  {
    href: '/admin/settings/billing',
    title: 'Billing providers',
    blurb: 'Stripe, Google Play, and Apple secrets used by the subscription flow.',
    icon: IconCreditCard,
    ready: false,
  },
  {
    href: '/admin/settings/branding',
    title: 'Branding',
    blurb: 'App name, logo, and theme overrides for white-labelled deployments.',
    icon: IconPalette,
    ready: false,
  },
];

export default function SettingsLanding() {
  return (
    <main className="px-4 lg:px-8 py-6 lg:py-8 space-y-5">
      <p className="text-sm text-slate-500 max-w-2xl">
        Read and tune the server-side configuration. Most fields here read from environment variables —
        update the deployment env to change them, then refresh this page to confirm.
      </p>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.ready ? s.href : '#'}
              className={[
                'group surface p-5 lg:p-6 flex gap-4 items-start transition-all',
                s.ready ? 'hover:shadow-card-lg hover:-translate-y-0.5' : 'opacity-60 cursor-not-allowed',
              ].join(' ')}
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">
                <Icon />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{s.title}</h2>
                  {!s.ready && (
                    <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Soon
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{s.blurb}</p>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" />
    </svg>
  );
}
function IconBell() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 21a2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCreditCard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
function IconPalette() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <path d="M12 3a9 9 0 1 0 9 9c0-2-2-3-4-3h-2a2 2 0 0 1-2-2V5c0-1-1-2-1-2z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7.5" cy="10.5" r="1" />
      <circle cx="12" cy="7.5" r="1" />
      <circle cx="16.5" cy="10.5" r="1" />
    </svg>
  );
}
