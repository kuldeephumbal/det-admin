'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Tabs shown at the top of every /admin/settings/* page. Add new
// sections here as they're built — each entry is a (label, href) pair
// matched against the current pathname for highlighting.
const TABS = [
  { href: '/admin/settings',          label: 'General' },
  { href: '/admin/settings/smtp',     label: 'Email (SMTP)' },
  { href: '/admin/settings/push',     label: 'Push (FCM)' },
  { href: '/admin/settings/billing',  label: 'Billing' },
  { href: '/admin/settings/branding', label: 'Branding' },
];

export default function SettingsTabs() {
  const path = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white animate-fade-in-up">
      <div className="px-4 lg:px-8 -mb-px overflow-x-auto">
        <div className="flex gap-1">
          {TABS.map((tab) => {
            // Exact-match for the index, otherwise startsWith.
            const active =
              tab.href === '/admin/settings'
                ? path === tab.href
                : path === tab.href || path.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  active
                    ? 'border-brand-500 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
                ].join(' ')}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
