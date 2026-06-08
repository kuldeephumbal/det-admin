import BroadcastForm from '@/components/admin/BroadcastForm';
import Topbar from '@/components/admin/Topbar';

export const dynamic = 'force-dynamic';

export default function NotificationsPage() {
  return (
    <>
      <Topbar
        title="Notifications"
        subtitle="Broadcast an announcement to every user."
      />
      <main className="px-4 lg:px-8 py-6 lg:py-8 animate-fade-in-up">
        <div className="max-w-2xl">
          <BroadcastForm />
        </div>

        <div className="mt-6 max-w-2xl flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-slate-500 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" strokeLinecap="round" />
            <line x1="12" y1="8" x2="12.01" y2="8" strokeLinecap="round" />
          </svg>
          <div className="text-xs text-slate-600 leading-relaxed space-y-2">
            <p>
              Broadcasts deliver as both an in-app inbox row AND a push to every active device.
              Title and body — that&apos;s it.
            </p>
            <p>
              <strong className="text-slate-800">Per-user reminders fire automatically</strong> when
              the relevant event happens — no admin action needed:
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Bill due in 3 days / 1 day / today — daily cron</li>
              <li>Budget threshold crossed (80% / 100% / 120%) — on every expense write</li>
              <li>Shared-account invite received</li>
              <li>Recurring expense materialized</li>
              <li>Weekly AI insight digest (Premium)</li>
              <li>Magic-link sign-in email</li>
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
