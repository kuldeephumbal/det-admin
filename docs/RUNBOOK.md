# DET — On-call runbook

What to do when something is on fire. Keep this short and skimmable.

## At-a-glance signals

| Signal | Where | Action |
| --- | --- | --- |
| `/api/health` returns non-200 | Uptime monitor | See "App is down" below |
| Mongo connection errors in logs | App logs | See "Mongo is down" |
| Sustained 5xx rate > 1% | App logs / Sentry | See "Elevated 5xx" |
| Cron not firing | Last `cron/recurring complete` log entry > 30 min ago | See "Cron stuck" |
| Login storm / brute force | Spike in 401s from one IP | See "Auth abuse" |

---

## App is down

1. `curl -i https://<host>/api/health` — what's the status?
2. Check the deployment dashboard (Vercel / Render / Fly) for a failed
   build or restart loop.
3. If a recent deploy is the suspect — **roll back first**, investigate
   second. On Vercel: previous deployment → "Promote to Production". On
   Render/Fly/k8s: redeploy the previous image SHA tag.
4. If Mongo connectivity is the problem, jump to "Mongo is down".

## Mongo is down

1. Atlas → Clusters → check status + recent metrics (CPU, connections, IOPS).
2. Recent connection spike? Check `maxPoolSize` in `lib/db.js` and the
   number of running instances. Typical cause: a runaway script.
3. If Atlas is healthy but the app can't reach it — the IP allowlist is
   the usual culprit after a serverless region change. Add the new IPs
   in Atlas → Network Access.
4. Worst case: the app gracefully degrades — `connectDB()` throws and
   `withRoute` returns 500s. No data corruption is possible (we never
   write to a degraded connection).

## Elevated 5xx

1. Sentry → most-frequent issues this hour. Group by `release` SHA.
2. App logs → grep for `INTERNAL_ERROR` and `Unhandled rejection`.
3. If a specific endpoint dominates, page the on-call engineer.
4. If a recent deploy is the suspect — roll back, then root-cause.

## Cron stuck

1. Last log line from the cron path:
   `grep cron/recurring <log-file>` — should see `cron/recurring complete`
   approximately every 15 minutes.
2. Manually fire it:
   `curl -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/recurring`
   If this works, the scheduler is the problem (Vercel cron, system cron, etc.).
3. If the manual call also fails — read the body. `UNAUTHORIZED` means the
   header isn't being set (rotate `CRON_SECRET` ↔ scheduler config drift).
4. To unblock users while you debug: in Atlas, run
   `db.recurring_expenses.find({ isActive: true, nextRunAt: { $lte: new Date() } })`
   and confirm there's a backlog. The materializer catches up to 50
   occurrences per row on the next successful run, so missed runs
   self-heal.

## Auth abuse

1. Identify the offending IP from access logs.
2. **Short term**: drop the offending IP at the edge (Cloudflare, your
   WAF, etc.). The in-app rate limiter (`lib/api/rateLimit.js`) is
   per-instance — useful but not sufficient at scale.
3. **Watch for**: bypass attempts on `/auth/refresh`. Reuse detection
   in `auth.service.rotateRefreshToken` revokes the full token family
   the first time a revoked token is replayed — confirm Sentry shows the
   `Refresh token reuse detected` warning.

## Promoting a user to admin

```js
// from `mongosh` against the production DB
db.users.updateOne({ email: 'you@example.com' }, { $set: { role: 'admin' } });
```

## Demoting / blocking a user

Either via the admin panel (Users → Block) or directly:

```js
db.users.updateOne({ email: 'spammer@example.com' }, { $set: { status: 'blocked' } });
```

## Rolling back a bad release

- **Vercel**: Deployments → previous deployment → "Promote to Production".
- **Render**: previous image SHA → Manual Deploy.
- **Fly**: `fly releases list` → `fly releases rollback <version>`.
- **k8s**: `kubectl rollout undo deployment/det`.

After rollback, capture the bad SHA and open a postmortem ticket.

## Restoring from backup

Atlas point-in-time restore is the source of truth. From the Atlas UI:
Backups → Restore → choose timestamp → restore into a fresh cluster
(never overwrite live in-place). Update `MONGO_URI` to point at the
restored cluster, redeploy.

## When you're paged

1. Acknowledge.
2. Mirror updates in the incident channel every 5 minutes, even if
   nothing has changed yet — silence reads as "no one is looking."
3. Once mitigated, write a postmortem within 48 hours.
4. File any follow-up tickets *during* the incident, not after.
