'use client';
import { useState } from 'react';

export default function BroadcastForm() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const send = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const r = await fetch('/api/v1/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          type: 'announcement',
          expiresInDays: Number(expiresInDays) || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setStatus({ ok: false, message: j?.error?.message || 'Failed' });
      } else {
        setStatus({ ok: true, message: 'Broadcast sent — in-app + push.' });
        setTitle('');
        setBody('');
      }
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm placeholder-slate-400 ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 transition';

  return (
    <form onSubmit={send} className="surface p-6 space-y-5">
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          placeholder="A short headline (e.g. New release out)"
          className={inputClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Body
          </label>
          <span className="text-[11px] text-slate-400">{body.length} / 1000</span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Optional longer description shown under the title…"
          className={`${inputClass} resize-y`}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
          Auto-expires after
        </label>
        <select
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value)}
          className={inputClass}
        >
          <option value="1">1 day</option>
          <option value="3">3 days</option>
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="btn-primary"
        >
          {busy ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                <line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" strokeLinejoin="round" />
              </svg>
              Send to all users
            </>
          )}
        </button>
        {status && (
          <span className={`text-sm font-medium ${status.ok ? 'text-emerald-700' : 'text-rose-700'} animate-fade-in`}>
            {status.message}
          </span>
        )}
      </div>
    </form>
  );
}
