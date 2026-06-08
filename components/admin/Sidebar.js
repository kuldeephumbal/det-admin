'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin',                  label: 'Dashboard',     icon: IconDashboard, end: true },
  { href: '/admin/users',            label: 'Users',         icon: IconUsers },
  { href: '/admin/categories',       label: 'Categories',    icon: IconCategories },
  { href: '/admin/notifications',    label: 'Notifications', icon: IconBell },
  { href: '/admin/subscriptions',    label: 'Subscriptions', icon: IconCreditCard },
  { href: '/admin/accounts',         label: 'Accounts',      icon: IconWallet },
  { href: '/admin/shared-accounts',  label: 'Shared accounts', icon: IconUsers },
  { href: '/admin/bills',            label: 'Bills',         icon: IconReceipt },
  { href: '/admin/debts',            label: 'Debts',         icon: IconHandshake },
  { href: '/admin/savings-goals',    label: 'Savings goals', icon: IconFlag },
  { href: '/admin/ocr-jobs',         label: 'OCR jobs',      icon: IconScan },
  { href: '/admin/insights',         label: 'Insights',      icon: IconBulb },
  { href: '/admin/financial-scores', label: 'Health scores', icon: IconShield },
  { href: '/admin/sms-rules',        label: 'SMS rules',     icon: IconMessage },
  { href: '/admin/bank-connections', label: 'Bank sync',     icon: IconBank },
  { href: '/admin/audit-log',        label: 'Audit log',     icon: IconAuditLog },
  { href: '/admin/settings',         label: 'Settings',      icon: IconSettings },
];

/**
 * Dark, premium sidebar.
 *  - Below `lg`: off-canvas drawer.
 *  - `lg`+:      static aside column.
 */
export default function Sidebar({ admin, open, onClose }) {
  const path = usePathname();

  return (
    <>
      {/* Backdrop scrim — mobile only */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          'lg:hidden fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      />

      <aside
        className={[
          'fixed lg:static lg:translate-x-0 inset-y-0 left-0 z-40',
          'w-72 lg:w-64 shrink-0',
          'bg-slate-950 text-slate-200',
          'border-r border-white/5',
          'relative overflow-hidden',
          'flex flex-col',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Decorative glow at the top — adds depth without being noisy. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full
                     bg-gradient-to-br from-brand-500/30 to-violet-500/10 blur-3xl"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-sidebar-noise" />

        {/* Brand row */}
        <div className="relative px-5 py-5 flex items-center justify-between shrink-0">
          <Link href="/admin" className="flex items-center gap-3 min-w-0 group">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600
                            grid place-items-center font-bold text-white shadow-glow-brand
                            transition-transform duration-200 group-hover:scale-105">
              <span className="text-base leading-none">D</span>
              <span className="absolute inset-0 rounded-xl shadow-inner-soft" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-white text-base tracking-tight">DET</div>
              <div className="text-[11px] uppercase tracking-widest text-slate-500">Admin</div>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden -mr-1 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition"
            aria-label="Close menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-5 h-5">
              <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
              <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Section label */}
        <div className="relative px-6 pt-3 pb-2 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Workspace</p>
        </div>

        {/* Nav */}
        <nav className="relative px-3 pb-3 flex-1 overflow-y-auto" data-stagger>
          {NAV.map((item) => {
            const active = item.end ? path === item.href : path.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'group/link relative flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl',
                  'text-sm font-medium animate-fade-in-up',
                  'transition-all duration-200',
                  active
                    ? 'bg-gradient-to-r from-brand-500/15 to-violet-500/10 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5',
                ].join(' ')}
              >
                <span
                  className={[
                    'absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full',
                    'transition-all duration-200',
                    active
                      ? 'bg-gradient-to-b from-brand-400 to-violet-500 opacity-100'
                      : 'opacity-0 group-hover/link:opacity-40 bg-slate-500',
                  ].join(' ')}
                />
                <Icon
                  className={[
                    'w-[18px] h-[18px] shrink-0',
                    'transition-transform duration-200 group-hover/link:translate-x-0.5',
                    active ? 'text-brand-300' : 'text-slate-500 group-hover/link:text-slate-300',
                  ].join(' ')}
                />
                <span className="truncate">{item.label}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Identity footer */}
        <div className="relative border-t border-white/5 p-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition">
            <div className="relative w-9 h-9 rounded-full shrink-0
                            bg-gradient-to-br from-brand-500 to-violet-600
                            grid place-items-center font-bold text-white text-sm
                            shadow-inner-soft">
              {(admin?.name || 'A').slice(0, 1).toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{admin?.name}</div>
              <div className="text-xs text-slate-500 truncate">{admin?.email}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ----- Icons ----- */

function IconDashboard(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  );
}
function IconUsers(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconCategories(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function IconBell(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
function IconCreditCard(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
function IconAuditLog(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}
function IconWallet(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M21 12h-4a2 2 0 0 0 0 4h4z" />
    </svg>
  );
}
function IconReceipt(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2-3 2z" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
    </svg>
  );
}
function IconHandshake(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M11 17l-3-3a2 2 0 0 1 0-3l5-5 2 2-3 3 6 6-2 2-5-5" />
      <path d="M5 14l3 3" />
      <path d="M19 14l-3 3" />
    </svg>
  );
}
function IconFlag(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 22V4h12l-1.5 4L16 12H4" />
      <line x1="4" y1="22" x2="4" y2="14" />
    </svg>
  );
}
function IconScan(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}
function IconBulb(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12c1 1 2 2 2 4h4c0-2 1-3 2-4a7 7 0 0 0-4-12z" />
    </svg>
  );
}
function IconShield(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconMessage(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconBank(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 21h18" />
      <path d="M3 10h18" />
      <path d="m12 3 9 7H3z" />
      <line x1="6" y1="14" x2="6" y2="20" />
      <line x1="10" y1="14" x2="10" y2="20" />
      <line x1="14" y1="14" x2="14" y2="20" />
      <line x1="18" y1="14" x2="18" y2="20" />
    </svg>
  );
}
function IconSettings(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
