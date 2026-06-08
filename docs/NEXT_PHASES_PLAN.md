# DET — Next Phases Implementation Plan (Phases 1–4)

Twelve features across four phases, evaluated against the existing DET
architecture (Next.js App Router + `withRoute` wrapper + service/model
split + Flutter/Riverpod). This is a planning document — no code yet.

> Read alongside [`OVERVIEW.md`](./OVERVIEW.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md),
> and [`DB_SCHEMA.md`](./DB_SCHEMA.md). All feature designs reuse the
> existing `withRoute → service → model` pipeline, Joi validators in
> `lib/validators/`, `withAudit` for admin mutations, and Riverpod
> StateNotifiers per feature on mobile.

---

## 0. Architectural principles applied throughout

1. **Reuse, don't rebuild.** Every feature here extends existing
   collections (User, Notification, Subscription, Expense, Budget,
   Category) before considering a new one. New collections appear only
   when (a) the data is high-cardinality, (b) the access pattern differs,
   or (c) lifecycle differs (e.g., OCR jobs).
2. **Thin handlers, thick services.** Route files stay 10–20 lines;
   business logic lives in `lib/services/<feature>.service.js`.
3. **Validation at the boundary.** All inputs through Joi schemas in
   `lib/validators/<feature>.validator.js`. No ad-hoc validation in
   services.
4. **Soft delete + audit-where-it-matters.** User-owned mutations soft-delete;
   admin mutations go through `withAudit`.
5. **Premium features behind a single gate.** A `requirePlan('premium')`
   helper added to `lib/api/auth.js` reads `req.user.plan` (already on
   the User schema). Avoid scattering plan checks in services.
6. **Notifications are uniform.** Every push-able event flows through one
   `notification.service.dispatch({ user, type, title, body, data })`
   which writes the in-app row AND fans out to FCM if tokens exist.
   Email, FCM, and in-app are three transports of the same event bus.
7. **Background work is one of three kinds.** Sync request, Vercel cron
   (scheduled), or a queued job table polled by cron (deferred async).
   We do NOT introduce a Redis/BullMQ worker until Phase 4 truly needs
   it; until then a Mongo-backed job table + cron is sufficient.
8. **Mobile features follow `data/application/presentation` layering**
   already in use; new features get their own `lib/features/<name>/`
   directory.

---

## 0.1 Feature priority matrix (high-level orientation)

| #  | Feature                       | Priority | MVP/Premium | Phase | Complexity |
| -- | ----------------------------- | -------- | ----------- | ----- | ---------- |
| 1  | FCM Push Notifications        | **High** | MVP         | 1     | Medium     |
| 2  | Email Verification            | **High** | MVP         | 1     | Low        |
| 3  | Device Management             | Medium   | MVP         | 1     | Medium     |
| 4  | Subscription Tracking         | **High** | MVP+Premium | 1     | Medium     |
| 5  | Savings Goals                 | **High** | MVP         | 2     | Medium     |
| 6  | Receipt Scanner OCR           | Medium   | Premium     | 2     | High       |
| 7  | Spending Calendar             | Medium   | MVP         | 2     | Low        |
| 8  | AI Insights                   | **High** | Premium     | 3     | High       |
| 9  | Smart Budget Suggestions      | Medium   | Premium     | 3     | Medium     |
| 10 | Financial Health Score        | Medium   | Premium     | 3     | Medium     |
| 11 | SMS Auto Expense Detection    | Low      | Premium     | 4     | High       |
| 12 | Bank Sync Integration         | **High** | Premium     | 4     | Very High  |

## 0.3 Implementation tracking

Live status of every feature. Update the checkbox + table row as work
lands. Sub-task breakdown lives in `TaskList`.

### Feature status

| # | Feature                       | Status        | Server | Mobile | Migration | Tests | Released |
| - | ----------------------------- | ------------- | ------ | ------ | --------- | ----- | -------- |
| 1 | FCM Push Notifications        | Complete\*\*   | [x]    | [x]\*\*| [x]       | [x]\* | [ ]      |
| 2 | Email Verification            | Complete      | [x]    | [x]    | [x]       | [x]\* | [ ]      |
| 3 | Device Management             | Complete      | [x]    | [x]    | [x]       | [x]\* | [ ]      |
| 4 | Subscription Tracking         | Complete\*\*   | [x]\*\* | [x]\*\* | [x]       | [x]   | [ ]      |
| 5 | Savings Goals                 | Complete      | [x]    | [x]    | [x]       | [x]\* | [ ]      |
| 6 | Receipt Scanner OCR           | Server done\*\* | [x]\*\* | [ ]    | [x]       | [ ]   | [ ]      |
| 7 | Spending Calendar             | Complete      | [x]    | [x]    | n/a       | [ ]   | [ ]      |
| 8 | AI Insights                   | Complete\*\*   | [x]\*\* | [x]    | [x]       | [ ]   | [ ]      |
| 9 | Smart Budget Suggestions      | Complete      | [x]    | [x]    | n/a       | [ ]   | [ ]      |
| 10| Financial Health Score        | Complete      | [x]    | [x]    | [x]       | [ ]   | [ ]      |
| 11| SMS Auto Expense Detection    | Server done\*\* | [x]    | [ ]    | [x]       | [ ]   | [ ]      |
| 12| Bank Sync Integration         | Server done\*\* | [x]\*\* | [ ]    | [x]       | [ ]   | [ ]      |

**Legend.** `Status` ∈ `Not started` / `In progress` / `Server done` / `Mobile done` / `Complete`. Tick a column with `[x]` once that slice is implemented AND tested. `Released` flips when shipped to the production track and rolled out.

`\*` next to a `[x]` = implemented and seen passing in at least one Jest run, but a clean dedicated re-run is pending (low-RAM host constraint).

`\*\*` next to a `[x]` = code written and wired but requires external setup before it actually runs end-to-end on a device. See the per-feature "External setup" notes below.

### External setup required

| Feature                 | What you need to do externally before it runs                                                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — FCM Push            | (server) set `FCM_CREDENTIALS_JSON` (base64) + `FIREBASE_PROJECT_ID`; `npm i firebase-admin`. (mobile) run `flutterfire configure` to write `lib/firebase_options.dart`; drop `google-services.json` into `mobile-app/android/app/`; drop `GoogleService-Info.plist` into `mobile-app/ios/Runner/`; upload an APNs auth key in the Firebase console for iOS; run `flutter pub get` to fetch `firebase_core` + `firebase_messaging`. Until those are in place, the mobile app initializes Firebase in no-op mode (logs and continues) and no token is registered. |
| 2 — Email Verification  | (server) set `EMAIL_VERIFICATION_TOKEN_TTL` (defaults to `24h`) and SMTP creds (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`). Without SMTP the mailer logs the verification link instead of sending — fine for dev, blocks real users in prod. Run migration `001-email-verified-backfill.js` once against prod to grandfather existing users. |
| 4 — Subscription Tracking | (server) install provider SDKs (`npm i stripe googleapis google-auth-library app-store-server-api`) and set: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (base64), `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_PUBSUB_AUDIENCE`, `APPLE_SHARED_SECRET`, `APPLE_BUNDLE_ID`. Run migration `003-subscription-events.js`. Register Vercel cron entry `0 3 * * *` → `/api/cron/subscriptions`. Register webhook endpoints with each provider. Until creds land, every adapter throws `BILLING_NOT_CONFIGURED` (503) — verify/webhook endpoints return cleanly instead of mis-applying state. Mobile paywall + IAP plumbing not yet wired (server slice only). |
| 6 — Receipt Scanner OCR | (server) install OCR + storage SDKs (`npm i @google-cloud/vision @aws-sdk/client-s3`); set `GOOGLE_VISION_CREDENTIALS_JSON` (base64) and either keep `STORAGE_PROVIDER=local` for dev or set R2 creds (`R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_RECEIPTS`). Run migration `006-receipt-scans.js`. Add Vercel cron `* * * * *` → `/api/cron/ocr`. Until creds land, the worker stamps each scan as `failed` with `OCR_NOT_CONFIGURED` — the workflow is observable in dev without burning real OCR cost. Mobile camera screens + pre-fill not yet wired (server slice only). |
| 8 — AI Insights | (server) install `npm i @anthropic-ai/sdk`; set `ANTHROPIC_API_KEY` and optionally override `ANTHROPIC_MODEL` (default `claude-haiku-4-5-20251001`). Run migration `008-insights.js`. Add Vercel cron `0 * * * *` → `/api/cron/insights` (hourly; service filters to Saturday-07:00 in each user's tz). Without the API key, the pipeline produces canned narrations — feature is observably alive without burning LLM tokens. Mobile insights feed not yet wired. |
| 11 — SMS Auto-Detection | (server) Run migration `010-sms-rules.js` (backfills `Expense.source`, builds the SmsParserRule + Expense.externalId indexes). Seed default Indian-bank parser rules via admin panel POST. Mobile background isolate (Android only) deferred — server only publishes the rules catalog at `GET /api/v1/sms-rules` (premium-gated). |
| 12 — Bank Sync | (server) generate a 32-byte `BANK_TOKEN_ENC_KEY` via `node -e "console.log(require('./lib/utils/encryption').newKeyBase64())"`; install `npm i plaid` and set `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_WEBHOOK_SECRET`. India track (Setu) blocked on RBI Account Aggregator legal review — adapter stays stubbed until then. Run migration `011-bank-collections.js`. Add Vercel cron `0 * * * *` → `/api/cron/bank-sync`. Register the Plaid webhook endpoint. Without creds, every adapter call returns `BANK_NOT_CONFIGURED` (503). Mobile WebView + connect screens deferred. |
| 4 — Subscription mobile | Real in-app purchase plumbing requires adding `in_app_purchase` (or platform-specific) to `mobile-app/pubspec.yaml` and wiring the purchase flow in `paywall_screen.dart` `_PaywallActions.upgrade`. Until then the paywall renders the plan catalog but shows a "plugin not wired" snackbar on tap. The `/subscription` manage screen and cancel flow work end-to-end against the server today. |

### Bugfix log

Append-only. One row per fix landed.

| Date       | Area                          | Description                                                                                              | Resolution                                                                       | Tests                                       |
| ---------- | ----------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------- |
| 2026-05-27 | `tests/services/auth.service.test.js` | Five tests used 1-character `name` fixtures violating the User schema's `minlength: 2`, causing `ValidationError` on `User.create`. Pre-existing in the repo. | Renamed fixtures to ≥2-char names (`Xander`, `Yara`, `Gina`, `Rotator`, `Rotator Two`, `Changer`, `Changer Two`). | Surfaced by the first Email Verification jest run. |

---

## 0.2 Feature dependency graph

```
                     ┌──────────────────────┐
                     │  Email Verification  │ ──┐
                     └──────────────────────┘   │
                                                ▼
┌───────────────────┐    ┌──────────────────────┐    ┌────────────────────┐
│ Device Management │ ─▶ │ FCM Push             │ ─▶ │ Subscription       │
└───────────────────┘    │ Notifications        │    │ Tracking (renewal  │
                         └──────────────────────┘    │ + plan gate)       │
                                                     └────────┬───────────┘
                                                              │ gates
   ┌────────────────────┐    ┌────────────────────┐           ▼
   │ Savings Goals      │    │ Spending Calendar  │   ┌────────────────────┐
   └────────────────────┘    └────────────────────┘   │ Receipt OCR        │ (Premium)
              │                                       └────────────────────┘
              ▼                                                 │
   ┌─────────────────────────────────────────────┐              │
   │ AI Insights ◀── Smart Budget Suggestions    │ ─────────────┘
   │                ▲                            │
   │                └─── Financial Health Score  │
   └─────────────────────────────────────────────┘
                                  │
                                  ▼
                       ┌─────────────────────────┐
                       │ SMS Auto-Detect (Android)│
                       │ Bank Sync (Aggregator)   │
                       └─────────────────────────┘
```

Hard dependencies:
- **#1 FCM** depends on **#3 Device Management** for token storage.
- **#4 Subscription Tracking** depends on **#2 Email Verification** for receipts and **#1 FCM** for renewal reminders.
- **#8 AI Insights** consumes data normalized by **#6 OCR**, **#11 SMS**, and **#12 Bank Sync**, but is independently usable on manually-entered expenses.
- **#9 Smart Budget Suggestions** and **#10 Financial Health Score** share an `analytics-engine` module derived from #8.

---

# PHASE 1 — Trust & Activation (Weeks 1–4)

Objective: every user account is verified, reachable on their device,
and on a known subscription tier.

---

## Feature 1 — FCM Push Notifications

**1. Overview.** Wire Firebase Cloud Messaging to dispatch every event already written to the `Notification` collection (budget alerts, recurring reminders, broadcasts) to the user's registered devices. The in-app notification path stays as-is; FCM becomes a second transport.

**2. Business value.** Re-engages dormant users (~3x DAU lift typical for budget apps), unlocks budget alerts that matter (timing >> in-app), and is a prerequisite for renewal/trial reminders monetizing #4.

**3. User flow.**
1. On login or app launch, Flutter requests notification permission and obtains an FCM token (`firebase_messaging.getToken()`).
2. Flutter POSTs `/api/v1/devices` with the token (handled by feature #3).
3. Any server event calls `notification.service.dispatch({...})`; the service writes the in-app row, then fans out to all of the user's active device tokens via FCM Admin SDK.
4. Tap on a push opens a deep link routed by GoRouter (`/notifications/:id`).
5. Stale tokens (FCM returns `UNREGISTERED`/`INVALID_ARGUMENT`) are auto-deactivated.


**4. Database changes.** Token storage is in the new `Device` collection (feature #3) — no schema change here. Add optional `pushPayload: Mixed` and `deliveryStatus: { sent, failed, deliveredAt }` to `Notification` for traceability.

**5. New collections.** None for this feature alone (uses `Device` from #3).

**6. Model schema design.** Extend `Notification`:
- `pushDelivery: { attemptedAt, succeededCount, failedCount, lastError }` — denormalized counters per fan-out.
- `deepLink: String` — `/notifications/:id`, `/budgets/:id`, etc.

**7. API endpoints.**

| Method | Path                                 | Purpose                                                   | Auth  |
| ------ | ------------------------------------ | --------------------------------------------------------- | ----- |
| POST   | `/api/v1/notifications/test`         | Server-side dev helper to send a push to caller's devices | user (dev only) |
| POST   | `/api/v1/admin/notifications/broadcast/push` | Admin one-shot push (no in-app row)              | admin |

No new public API needed — push fan-out is internal. The existing
broadcast endpoint (`POST /admin/notifications/broadcast`) is extended
to optionally include `pushOnly: true`.

**8. Joi validation.**
- `pushOptions`: `{ pushOnly: boolean (default false), highPriority: boolean }` on broadcast.
- `testPush`: `{ title: 1–60, body: 1–240, data?: object }`.

**9. Service layer design.** New `lib/services/fcm.service.js`:
- `init()` — lazy-init Firebase Admin SDK from a service-account JSON in env (`FCM_CREDENTIALS_JSON`, base64).
- `sendToTokens(tokens, payload)` — chunked multicast (max 500/req).
- `pruneInvalidTokens(failedResponses, userId)` — flips `Device.isActive=false` for `UNREGISTERED`.
- `notification.service.dispatch()` is rewritten to: write Notification → look up active Devices → call `fcm.sendToTokens` → update `pushDelivery`. The write to `Notification` is the source of truth; FCM failures never block it.

**10. Admin panel changes.** On `/admin/notifications`, add: device-count column to user broadcast preview, "Push only" toggle in the broadcast form, and a "Delivery details" drawer showing `pushDelivery` counters.

**11. Flutter mobile screens required.**
- No new screens. Modify Settings → "Notifications" toggle (already present) to call `permission_handler` + register token.
- Deep-link handling added to `core/router.dart`.

**12. Flutter state management.**
- New `core/push/push_service.dart` (singleton) registered at app start in `main.dart`; uses `firebase_messaging`.
- `pushTokenProvider` (FutureProvider) — token value reactive.
- Token registration tied into existing `authControllerProvider` post-login.

**13. Notification requirements.** This is the feature.

**14. Security.**
- FCM service-account JSON stored as a single base64 env var; never logged.
- Tokens stored hashed for index lookup if at risk of exfiltration (acceptable trade-off: keep plaintext, since FCM API needs them and they're per-device).
- Rate-limit `/devices` register to prevent token spam.
- Never include sensitive amounts in push body — use `"You're at 90% of your Food budget"` not `"₹4,237 / ₹5,000"` unless user opts in.

**15. Scalability.** Multicast batches of 500. Fan-out cost is O(devices/user). For broadcasts, dispatch in a background job (Mongo-queue + cron) so admin POST returns immediately.

**16. Testing.**
- Service tests with mocked Admin SDK (jest moduleNameMapper for `firebase-admin`).
- Integration: in-app row is always created even when FCM throws.
- Manual: physical device + emulator end-to-end smoke per release.

**17. Deployment.** Secrets to add: `FCM_CREDENTIALS_JSON` (base64), `FIREBASE_PROJECT_ID`. Mobile: `google-services.json` (Android), `GoogleService-Info.plist` (iOS), APNs key uploaded to Firebase console.

**18. Risks & edge cases.**
- iOS background restrictions — APNs entitlement required.
- Notification spam if a user has 10 devices — cap active devices per user at 10 (LRU eviction).
- Timezone-aware quiet hours (Phase 1 ships without; Phase 3 may add).
- Silent failure: an FCM error that isn't `UNREGISTERED` shouldn't deactivate the token.

**19. Complexity.** Medium.
**20. Time estimate.** **5–6 days** server + mobile.

**MVP vs Premium.** MVP. **Monetization:** push is the delivery channel for premium-only features (renewal reminders, AI insight pings). The premium "smart timing" (quiet hours, ML-best-time) lands in Phase 3.

---

## Feature 2 — Email Verification

**1. Overview.** New users must click a tokenized email link before they can use write-side APIs (POST expenses/budgets/etc.). Existing accounts get a one-time backfill flag (`emailVerifiedAt: null` ⇒ treated as legacy = verified, with a grace period flag).

**2. Business value.** Cuts spam signups, enables transactional email (Phase 1.5 monetization), required for App Store / Play Store guidelines around in-app purchase receipts (#4).

**3. User flow.**
1. On `/auth/register`, send verification email with a hashed token (TTL 24h). Same template engine as password reset.
2. User clicks link → `/api/v1/auth/verify-email?token=...` → server verifies, sets `emailVerifiedAt`.
3. Mobile blocks expense creation behind a soft banner + modal until verified; reads/listings still work.
4. Resend endpoint with rate-limit (1 per 60s, 5 per day).

**4. Database changes.** Add to `User`: `emailVerifiedAt: Date|null`, `emailVerificationToken: { tokenHash, expiresAt, sentAt }` (select:false). Backfill: existing users get `emailVerifiedAt = createdAt`.

**5. New collections.** None.

**6. Model schema.** As above — fields hang off User, mirroring the existing `passwordResetToken` pattern in `lib/models/User.js`.

**7. API endpoints.**

| Method | Path                                 | Auth   |
| ------ | ------------------------------------ | ------ |
| POST   | `/api/v1/auth/send-verification`     | user (unverified) |
| POST   | `/api/v1/auth/verify-email`          | public (token in body) |

**8. Joi validation.** `verifyEmail`: `{ token: string(64).hex().required() }`. `sendVerification`: `{}` (uses authed user).

**9. Service layer.** Add `auth.service.sendVerification(user)` and `verifyEmail(token)`. Reuse `lib/utils/mailer.js`. A new helper `requireVerified` middleware option in `withRoute` (`{ auth: 'user', requireVerified: true }`) gates write routes.

**10. Admin panel changes.** Users table: column for `emailVerifiedAt`; filter for unverified. "Force verify" admin action (audited) for support cases.

**11. Flutter screens required.**
- `lib/features/auth/presentation/verify_email_screen.dart` — shown when API returns 403 + `code: EMAIL_NOT_VERIFIED`.
- Banner widget on Home if unverified.
- Deep link `/verify-email?token=...` (router redirect after verification).

**12. Flutter state.** Extend `auth_controller.dart` `AuthState` with `emailVerified: bool`. New `verifyEmailControllerProvider` for the screen.

**13. Notifications.** Verification is email-only by design (push doesn't make sense pre-verification). Welcome notification after success (in-app + push if device registered).

**14. Security.** Token hashed (sha256) in DB. TTL 24h. Constant-time compare. No-enumeration on `send-verification` (always 200). Rate-limit aggressively.

**15. Scalability.** Trivial — email send is fire-and-forget via existing `mailer.js`.

**16. Testing.** Service tests for hash + TTL, rate-limit boundary, idempotent verify (verifying twice with same token = 200), expired token = 410.

**17. Deployment.** Requires SMTP creds (already env-supported). Add `EMAIL_VERIFICATION_TOKEN_TTL` env.

**18. Risks & edge cases.**
- Disposable email providers — block list optional (Phase 2).
- Email never arrives (spam folder) — clear "resend" UX; show last-sent timestamp.
- Race between two verify clicks — idempotent by token consumption.
- Legacy users — handle via backfill migration script (see migration plan §13).

**19. Complexity.** Low.
**20. Time.** **2–3 days**.

**MVP/Premium.** MVP. **Monetization indirect:** enables premium upsell emails post-verification.

---

## Feature 3 — Device Management

**1. Overview.** First-class `Device` collection: every login registers a device with platform/model/OS/FCM token. Users can see all sessions and revoke any device, which invalidates its refresh-token family.

**2. Business value.** Security signal (suspicious-login emails), a UX feature competitive apps have, and the underlying registry for FCM (#1).

**3. User flow.**
1. On login, mobile sends `POST /devices` with `{ fcmToken, platform, model, osVersion, appVersion, locale }`.
2. Server links the active `RefreshToken.family` to a `Device._id`.
3. Settings → Devices lists all active devices.
4. User taps "Sign out" on a device → revokes that family → push the device a `force-logout` data-only message.

**4. Database changes.** New `Device` collection. Link `RefreshToken.deviceId: ObjectId` (already has `family`).

**5. New collection — `devices`.**

| Field            | Type        | Notes                                          |
| ---------------- | ----------- | ---------------------------------------------- |
| `user`           | ObjectId    | indexed                                        |
| `fcmToken`       | String      | unique sparse                                  |
| `platform`       | Enum        | `android` / `ios` / `web`                      |
| `model`          | String      | e.g., "Pixel 7"                                |
| `osVersion`      | String      |                                                |
| `appVersion`     | String      |                                                |
| `locale`         | String      |                                                |
| `lastSeenAt`     | Date        |                                                |
| `firstSeenAt`    | Date        |                                                |
| `ip`             | String      | last login IP                                  |
| `userAgent`      | String      |                                                |
| `isActive`       | Boolean     | false after revoke / FCM `UNREGISTERED`        |
| `revokedAt`      | Date \| null|                                                |

**Indexes:** `(user, isActive, lastSeenAt desc)`, unique sparse `fcmToken`.

**6. Model schema.** As above. Hooks: `pre('save')` updates `lastSeenAt`.

**7. API endpoints.**

| Method | Path                          | Auth |
| ------ | ----------------------------- | ---- |
| POST   | `/api/v1/devices`             | user |
| GET    | `/api/v1/devices`             | user |
| DELETE | `/api/v1/devices/:id`         | user (revoke session) |
| PATCH  | `/api/v1/devices/:id/token`   | user (rotate FCM token) |

**8. Joi validation.** `registerDevice`: `{ fcmToken, platform: enum, model: max(80), osVersion: max(40), appVersion: max(20), locale: max(20) }`. `id`: Mongo ObjectId.

**9. Service layer.** `lib/services/device.service.js` — `register`, `list(userId)`, `revoke(userId, deviceId)`, `touch(userId, deviceId)` (called per refresh). Integrates with `auth.service.refresh` to update `lastSeenAt`.

**10. Admin panel changes.** Users detail page → "Active devices" tab (read-only). Admin can force-revoke (audited).

**11. Flutter screens.**
- `lib/features/settings/devices/devices_screen.dart` — list with model, platform, last seen, "this device" badge, revoke button.

**12. Flutter state.** `devicesControllerProvider` (StateNotifier). Token registration moved into `core/push/push_service.dart` (shared with #1).

**13. Notifications.** New device login → email + push to other devices ("New sign-in from Pixel 7").

**14. Security.** Revoking a device revokes the RefreshToken family (already supported). Suspicious-login detection (new country/IP) emits a notification. FCM token rotation does NOT change device identity.

**15. Scalability.** Cap 10 active devices per user (LRU evict on register). Index supports list scans even at 50M devices.

**16. Testing.** Service tests for register/revoke/touch. Integration: revoke → refresh-token call returns 401.

**17. Deployment.** No new infra.

**18. Risks & edge cases.**
- Multiple installs on same physical device (uninstall/reinstall) — old token becomes `UNREGISTERED`; LRU eviction handles it.
- Web sessions — `platform: 'web'` rows for admin panel, no FCM token.
- Privacy: never expose IP/UA to the user, only `model + lastSeenAt + location-city`.

**19. Complexity.** Medium.
**20. Time.** **4–5 days**.

**MVP/Premium.** MVP. **Monetization:** none directly; enables suspicious-login alerts as a premium add-on (Phase 3).

---

## Feature 4 — Subscription Tracking

**1. Overview.** Promote the existing `Subscription` collection from passive overview to active billing tracking with provider integration (Google Play Billing + Apple StoreKit + Stripe for web), trial → premium upgrades, renewal reminders, and dunning on failed payments.

**2. Business value.** Direct revenue. The free/premium gate already exists in `User.plan` and the `Subscription` schema — this turns it on.

**3. User flow.**
1. User taps "Upgrade" → in-app purchase via platform SDK.
2. Client POSTs purchase receipt → `/api/v1/subscriptions/verify`.
3. Server verifies with provider (Google/Apple/Stripe), upserts `Subscription`, flips `User.plan='premium'`.
4. Webhook (Stripe) or polling (Google) drives renewals/cancellations.
5. T-7 / T-3 / T-1 day renewal reminders via push + email.

**4. Database changes.** Existing `Subscription` schema is sufficient (it already has `provider*`, `currentPeriodEnd`, `features`). Add:
- `Subscription.events[]` — append-only history `{ at, type, provider, raw }` for audit (max 200 entries, then truncate to last 100).
- `Subscription.gracePeriodUntil: Date|null`.
- `User.planValidUntil: Date` — denormalized for fast gate checks.

**5. New collections.** None. Optionally `subscription_webhook_events` (idempotency key for retries) — recommended.

**6. Model schema.**
- New `webhook_events`: `{ provider, eventId (unique), receivedAt, processedAt, raw, error }`.

**7. API endpoints.**

| Method | Path                                              | Auth   |
| ------ | ------------------------------------------------- | ------ |
| GET    | `/api/v1/subscriptions/me`                        | user   |
| POST   | `/api/v1/subscriptions/verify`                    | user   |
| POST   | `/api/v1/subscriptions/cancel`                    | user   |
| GET    | `/api/v1/subscriptions/plans`                     | public |
| POST   | `/api/v1/webhooks/stripe`                         | provider |
| POST   | `/api/v1/webhooks/google-play`                    | provider |
| POST   | `/api/v1/webhooks/apple`                          | provider |
| PATCH  | `/api/v1/admin/subscriptions/:id`                 | admin (audited) |

**8. Joi validation.**
- `verifyPurchase`: `{ provider: enum('google'|'apple'|'stripe'), receipt: string, productId: string }`.
- `cancel`: `{ reason?: max(200) }`.
- Webhooks bypass Joi (raw body, signature-verified).

**9. Service layer.** New `lib/services/subscription.service.js` and `lib/services/billing/{stripe,google,apple}.js` adapters.
- `verifyAndUpsert(userId, payload)` — provider-specific receipt verification.
- `handleWebhook(provider, signature, rawBody)` — idempotent event handling.
- `expireDueSubscriptions()` — cron-driven (daily) — flips `User.plan='free'` past grace period.
- `sendRenewalReminders()` — cron (daily) — fans out reminders.

**10. Admin panel changes.** `/admin/subscriptions` → searchable + filterable by status/plan; row drawer with event history; "Comp premium" admin action (extend `currentPeriodEnd`, audited).

**11. Flutter screens.**
- `lib/features/subscription/presentation/paywall_screen.dart`
- `lib/features/subscription/presentation/manage_subscription_screen.dart`
- `lib/features/subscription/presentation/receipt_history_screen.dart`

**12. Flutter state.** `subscriptionControllerProvider` exposing `{ plan, status, currentPeriodEnd, isPremium, gracePeriod }`. A `requirePremiumProvider` for gating UI on premium screens.

**13. Notifications.**
- T-7/T-3 renewal reminders (push + email).
- Payment failed → in-app + push + email with retry deep-link.
- Trial ending in 24h.
- Successful upgrade → in-app welcome.

**14. Security.**
- Verify webhook signatures (Stripe: `Stripe-Signature`, Apple: JWT in body, Google: Pub/Sub message verification).
- Idempotency on `webhook_events.eventId`.
- Never trust client-supplied `productId` without provider verification.
- No PII (card details) ever lands in DB.

**15. Scalability.** Webhook handlers are lightweight; the periodic cron is O(active subs). Index `Subscription.currentPeriodEnd` for the daily expiry scan.

**16. Testing.**
- Sandbox accounts for Google/Apple, Stripe test mode.
- Service tests for receipt verification using recorded provider fixtures.
- Replay test: same webhook event twice ⇒ one effect.
- E2E: paywall → mock provider success → premium screens unlock.

**17. Deployment.** Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `APPLE_SHARED_SECRET`. Webhook endpoints whitelisted past CORS. Vercel cron entries for daily expiry + reminders.

**18. Risks & edge cases.**
- Refunds (Apple "Cancel/Refund" webhook) — must downgrade immediately and stamp `Subscription.events`.
- Plan changes mid-cycle (upgrade/downgrade) — prorate by provider, don't recompute server-side.
- Family sharing on iOS — treated as one purchase.
- Grace period for failed renewal: 3 days before downgrade.
- App store policies: do NOT route in-app purchases through Stripe on iOS; web-only.

**19. Complexity.** Medium.
**20. Time.** **8–10 days** (the bulk is provider integration + webhook idempotency).

**MVP/Premium.** MVP (free tier) + the upgrade flow itself. **Monetization:** this is the monetization feature. Tiers suggested:
- Free: 3 categories beyond defaults, 1 budget, no OCR, no AI.
- Premium (₹99/month, ₹799/year): unlimited categories/budgets, OCR, AI, multi-device push, advanced reports, bank sync.

---

# PHASE 2 — Engagement Depth (Weeks 5–7)

Objective: more reasons to open the app daily.

---

## Feature 5 — Savings Goals

**1. Overview.** A `SavingsGoal` collection — target amount, deadline, optional auto-contribution rule that creates a virtual "savings" expense or links to actual transfers (manual entry initially; bank-sync in Phase 4).

**2. Business value.** Lifts retention (apps with goal-tracking show 25–40% higher 90-day retention). Natural surface for AI nudges (#8).

**3. User flow.**
1. Create goal: name, target ₹, deadline, optional weekly/monthly auto-contribution.
2. View progress ring on dashboard; tap → contribution history.
3. Contribute manually (one-tap) → creates a `GoalContribution`.
4. On-track / behind status, computed daily.
5. Goal hit → celebratory push + in-app modal.

**4. Database changes.** Two new collections; no existing schema change required.

**5. New collections.**
- `savings_goals`: `user, name, icon, color, targetAmount, currency, currentAmount, deadline, contributionRule?, status: active|completed|abandoned, completedAt, deletedAt`.
- `goal_contributions`: `user, goal, amount, occurredAt, source: 'manual'|'auto'|'bank', note, deletedAt`.

**6. Model schema.**
- Goals: `contributionRule: { frequency: enum, amount: Number, nextRunAt: Date }` — mirror of `RecurringExpense.nextRunAt` so cron handles both.
- Indexes: `(user, status, deadline)`, `(user, goal, occurredAt desc)`.

**7. API endpoints.**

| Method | Path                                       | Auth |
| ------ | ------------------------------------------ | ---- |
| GET    | `/api/v1/savings-goals`                    | user |
| POST   | `/api/v1/savings-goals`                    | user |
| PATCH  | `/api/v1/savings-goals/:id`                | user |
| DELETE | `/api/v1/savings-goals/:id`                | user |
| POST   | `/api/v1/savings-goals/:id/contribute`     | user |
| GET    | `/api/v1/savings-goals/:id/contributions`  | user |
| GET    | `/api/v1/savings-goals/:id/status`         | user (on-track calc) |

**8. Joi validation.** Standard CRUD shapes. `contribute`: `{ amount: positive, occurredAt?: date, note?: max(200) }`.

**9. Service layer.** `lib/services/savings.service.js` — CRUD, contribute, status calc (linear projection vs deadline). Cron extension: `app/api/cron/recurring/route.js` also picks up `savings_goals` with `contributionRule.nextRunAt <= now` and creates auto contributions.

**10. Admin panel changes.** Optional `/admin/savings-goals` analytics page (aggregate goals per user, completion rate). Nice-to-have, not MVP.

**11. Flutter screens.**
- `lib/features/savings/presentation/goals_list_screen.dart`
- `lib/features/savings/presentation/goal_detail_screen.dart` (progress ring, contributions, edit)
- `lib/features/savings/presentation/create_goal_sheet.dart`
- Dashboard widget for top-3 goals.

**12. Flutter state.** `goalsControllerProvider`, `goalDetailControllerProvider(goalId)`. Reuses `BudgetProgressRing` widget for visualization.

**13. Notifications.**
- T-7 deadline approaching reminder.
- Goal hit (celebration).
- Auto-contribution successful.
- "You're behind on goal X" weekly nudge (premium AI tier).

**14. Security.** Standard `user-owned data` invariant (filter by `user: ctx.user.id`). No new threat surface.

**15. Scalability.** Same indexes pattern as Budget. Contribution writes are O(1).

**16. Testing.** Service tests for status math (deadline projection), auto-contribution cron, completion transition.

**17. Deployment.** None new.

**18. Risks & edge cases.**
- Goal currency vs user's default (allow mismatch; convert on display in Phase 3 if needed).
- Negative contributions (withdrawals) — allow, treat as undo.
- Goal hit but auto-contribution scheduled — stop the rule.

**19. Complexity.** Medium.
**20. Time.** **5–6 days**.

**MVP/Premium.** MVP. **Monetization:** unlimited goals = premium; free = 1 active goal.

---

## Feature 6 — Receipt Scanner OCR

**1. Overview.** Camera-scan or gallery-pick a receipt → OCR extracts merchant, total, date, line items → pre-fills the Add-Expense sheet → user reviews and saves. Receipt image stored as attachment.

**2. Business value.** Reduces friction (manual entry is the #1 churn driver in expense apps). Premium gate justification.

**3. User flow.**
1. FAB → "Scan receipt" → camera.
2. Image uploaded to `/api/v1/receipts` (multipart).
3. Server stores image (S3 or local), creates `ReceiptScan` job with `status: pending`.
4. Worker (cron tick @ 1 min) picks pending jobs, calls OCR provider (Google Cloud Vision, AWS Textract, or open-source PaddleOCR locally).
5. Job moves to `processing` → `completed` (or `failed`) with extracted fields.
6. Mobile polls `/receipts/:id` (or via FCM data-only message — preferred) for completion → opens pre-filled Add-Expense sheet.
7. User confirms → an `Expense` is created with `attachmentUrl = receipt.imageUrl`.

**4. Database changes.** New `ReceiptScan` collection. Existing `Expense.attachmentUrl` is reused.

**5. New collections.**
- `receipt_scans`: `user, imageUrl, thumbnailUrl, status, ocrProvider, extracted: { merchant, total, currency, date, lineItems[] }, confidence, error, expenseId?, createdAt, completedAt`.

**6. Model schema.**
- Indexes: `(user, status, createdAt desc)`, `(status, createdAt asc)` for the worker scan.
- TTL on failed scans after 30 days.

**7. API endpoints.**

| Method | Path                                  | Auth |
| ------ | ------------------------------------- | ---- |
| POST   | `/api/v1/receipts` (multipart)        | user (premium) |
| GET    | `/api/v1/receipts/:id`                | user |
| GET    | `/api/v1/receipts` (history)          | user |
| DELETE | `/api/v1/receipts/:id`                | user |

**8. Joi validation.** File size ≤ 8MB, mime in `image/jpeg|png|webp|heic`. Validation happens before multipart parsing (use `Content-Length` header).

**9. Service layer.** `lib/services/receipt.service.js` — `enqueue`, `process` (worker), `attachToExpense`. New `lib/services/ocr/` adapters: `vision.js`, `textract.js`, `paddle.js`.

**10. Admin panel changes.** OCR jobs queue view at `/admin/jobs/ocr` — read-only, useful for support.

**11. Flutter screens.**
- `lib/features/receipts/presentation/scan_camera_screen.dart` (uses `camera` package)
- `lib/features/receipts/presentation/receipt_preview_screen.dart` (extracted fields, edit)
- Modify `add_expense_sheet.dart` to accept a `receiptId` and pre-fill.

**12. Flutter state.** `receiptScanControllerProvider` (single in-flight upload). FCM data-only message triggers state refresh on completion.

**13. Notifications.** Data-only push on OCR completion (no UI alert). Push notification on failure with "Re-scan" CTA.

**14. Security.**
- Receipt images contain PII (merchant, amounts). Store in user-scoped S3 prefix with signed-URL access.
- Strip EXIF GPS on upload.
- Virus-scan via ClamAV side-car or skip if using managed storage with built-in scanning.
- Premium-gate the endpoint at the wrapper level.

**15. Scalability.**
- OCR cost is variable per provider (~$0.0015/image via Google Vision). Cap free-tier scans at 5/month if offered there.
- Worker concurrency: 5 jobs/min initially, scale by adjusting cron frequency.
- Images stored in cold storage tier after 90 days.

**16. Testing.** Service tests with fixture images + recorded OCR responses. Mobile widget test that pre-fill flow opens correctly.

**17. Deployment.** Secrets: OCR provider credentials. Storage: `S3_BUCKET_RECEIPTS`, `S3_ACCESS_KEY_ID/SECRET`. The first version can use local disk in dev / Cloudflare R2 in prod.

**18. Risks & edge cases.**
- Multi-language receipts (Hindi + English). Google Vision handles most; PaddleOCR is a fallback.
- Total ambiguity (subtotal vs tax vs total) — pick the largest matching ₹ pattern, let user correct.
- Image rotation / glare — show a confidence score; below 0.6 prompts re-scan.
- Privacy: explicit consent screen on first scan; data retention policy (auto-delete after 1 year).

**19. Complexity.** High.
**20. Time.** **8–10 days**.

**MVP/Premium.** Premium-only. **Monetization:** signature premium feature. Could ship a "3 free scans/month" trial for free tier.

---

## Feature 7 — Spending Calendar

**1. Overview.** Month/week calendar view where each day shows a colored dot/heatmap intensity scaled to that day's spending; tap a day to drill into expenses. No new collections — purely a read view over `Expense`.

**2. Business value.** Visual pattern surfaced ("I always overspend on Fridays"); low effort, high perceived polish.

**3. User flow.**
1. Tab "Calendar" in HomeShell.
2. Default: current month, heatmap of daily totals.
3. Tap a day → bottom sheet with that day's expenses + total.
4. Swipe horizontally to change month.

**4. Database changes.** None.

**5. New collections.** None.

**6. Model schema.** None.

**7. API endpoints.**

| Method | Path                                  | Auth |
| ------ | ------------------------------------- | ---- |
| GET    | `/api/v1/reports/calendar?from&to`    | user |

Returns `[{ date: 'YYYY-MM-DD', total, count }]` for the range.

**8. Joi validation.** `{ from: ISO date, to: ISO date, maxRange: 60d }`.

**9. Service layer.** Extend `analytics.service.js` with `dailyTotals(userId, from, to)` — single `$group` by `$dateToString('%Y-%m-%d', $date, $timezone)`.

**10. Admin panel changes.** None.

**11. Flutter screens.**
- `lib/features/calendar/presentation/calendar_screen.dart` (uses `table_calendar` package).
- Day-detail bottom sheet (reuses existing expense list tile).

**12. Flutter state.** `calendarControllerProvider(month)` (FutureProvider.family by month string).

**13. Notifications.** None.

**14. Security.** None new.

**15. Scalability.** Aggregation indexed by `(user, date desc)`. Limit range to 60 days per request.

**16. Testing.** Service test for timezone-correct grouping (user in IST should see midnight-IST buckets, not UTC).

**17. Deployment.** None.

**18. Risks & edge cases.** Timezone correctness is the only real gotcha — pull `user.preferences.timezone` and use it in the aggregation.

**19. Complexity.** Low.
**20. Time.** **3 days**.

**MVP/Premium.** MVP. **Monetization:** premium unlocks "heatmap across multiple years" + comparison view.

---

# PHASE 3 — Intelligence Layer (Weeks 8–10)

Objective: from "tracker" to "advisor". Premium-tier value.

---

## Feature 8 — AI Insights

**1. Overview.** A weekly/on-demand "Insights" feed: anomaly detection, comparisons (vs last month/week), category-level notes, narrative natural-language summaries. Powered by a deterministic analytics pipeline + LLM-generated narrative (Anthropic Claude API via server, never from mobile).

**2. Business value.** The hook for premium retention. "Why am I broke?" is the question users actually have.

**3. User flow.**
1. Tab "Insights" in HomeShell.
2. Pinned: "This week's summary" card.
3. List of insight cards: anomalies, savings opportunities, predictions.
4. Each card has actionable CTAs ("Set budget for Food", "Adjust goal X").
5. Weekly digest sent via push + email Saturday morning.

**4. Database changes.** New `Insight` collection (caches generated insights so the LLM isn't called per-view).

**5. New collections.**
- `insights`: `user, type, period: { from, to }, severity, title, body, data, cta?, isRead, generatedAt, model, costTokens?`.

**6. Model schema.**
- Indexes: `(user, period.to desc)`, `(user, isRead, generatedAt desc)`.
- TTL: 180 days.

**7. API endpoints.**

| Method | Path                                  | Auth |
| ------ | ------------------------------------- | ---- |
| GET    | `/api/v1/insights`                    | user (premium) |
| POST   | `/api/v1/insights/regenerate`         | user (premium, rate-limited) |
| PATCH  | `/api/v1/insights/:id/read`           | user |

**8. Joi validation.** `regenerate`: `{ period: enum('week'|'month') }`.

**9. Service layer.** New `lib/services/ai/` directory:
- `insights.service.js` — pipeline: gather features → run deterministic detectors → call LLM for narrative → persist.
- `features.js` — feature extraction (per-category MoM delta, week-over-week, std dev anomalies).
- `llm.js` — wrapper around Anthropic SDK with prompt caching (cache the system prompt + user financial schema description).

Weekly digest cron: `app/api/cron/insights/route.js` runs every Saturday 7am user-local-time (use existing cron + per-user TZ scheduling).

**10. Admin panel changes.** `/admin/insights` — aggregate generation cost per day, top failures, regenerate-on-demand for support.

**11. Flutter screens.**
- `lib/features/insights/presentation/insights_screen.dart`
- Insight card widget (severity-colored).

**12. Flutter state.** `insightsControllerProvider` (paginated). Insight CTAs deep-link into existing features (budgets, goals).

**13. Notifications.** Weekly digest push + email. High-severity anomaly → immediate push ("Unusual ₹3,200 spent on dining yesterday").

**14. Security.**
- Send ONLY aggregated numerical features to the LLM, never raw notes or attachment URLs.
- PII scrubbing layer before LLM call.
- Strict premium gate.
- Anthropic API key in env; rotate per quarter.

**15. Scalability.**
- Prompt caching on the system prompt (90% cost reduction per Anthropic docs).
- Pre-compute features in the cron, only call LLM when features cross thresholds (no insight if nothing notable).
- Cap regenerate at 3/day per user.

**16. Testing.** Detector unit tests (anomaly threshold math). Snapshot tests for prompt construction. Mocked LLM in service tests.

**17. Deployment.** Secrets: `ANTHROPIC_API_KEY`. Cron entry. Monitor cost in dashboard.

**18. Risks & edge cases.**
- Hallucinated numbers — the LLM is only asked to **narrate** numbers we pass in; we validate the response's numbers match our inputs before showing.
- Low-data users (< 30 days history) — fall back to non-LLM canned messages.
- Cost explosion — daily budget cap per user; pause generation past threshold.

**19. Complexity.** High.
**20. Time.** **8–10 days**.

**MVP/Premium.** Premium-only. **Monetization:** the headline premium feature alongside #6.

---

## Feature 9 — Smart Budget Suggestions

**1. Overview.** When the user creates/edits a budget, the app suggests an amount based on past 3–6 months in that category (median + 10% buffer, seasonally adjusted). Also surfaces "you should set a budget for X" if a category has consistent spending but no budget.

**2. Business value.** Removes the "what should I budget?" friction; activates Budget feature for users who haven't set one.

**3. User flow.**
1. Open "Create budget" sheet → category picker → suggestion appears as a pre-filled amount with "Why this number" tap-to-expand.
2. Home banner: "You spend ₹X on Food/month but have no budget — set one?"

**4. Database changes.** None (purely computed from existing `Expense` aggregations).

**5. New collections.** None. Optionally `budget_suggestions` cache (24h TTL) if recompute is hot — skip until measured.

**6. Model schema.** None new.

**7. API endpoints.**

| Method | Path                                              | Auth |
| ------ | ------------------------------------------------- | ---- |
| GET    | `/api/v1/budgets/suggestions?category=&period=`   | user |
| GET    | `/api/v1/budgets/suggestions/missing`             | user (categories without budgets) |

**8. Joi validation.** Standard query params.

**9. Service layer.** Extend `budget.service.js` with `suggestForCategory(userId, categoryId, period)` and `missingBudgets(userId)`. Pure aggregation; reuses analytics pipelines.

**10. Admin panel changes.** None.

**11. Flutter screens.** Modify `edit_budget_sheet.dart` to show suggestion. Home banner widget for missing budgets.

**12. Flutter state.** `budgetSuggestionProvider(categoryId)` (FutureProvider.family).

**13. Notifications.** Monthly "Time to review your budgets" reminder (in-app).

**14. Security.** None new.

**15. Scalability.** O(n) over the user's expenses in window; same indexes as analytics. Suggestion is per-request; cache in-memory for 5 min per user if hot.

**16. Testing.** Service tests: low data, high variance, seasonality (December spike).

**17. Deployment.** None.

**18. Risks & edge cases.**
- New user (< 60 days history) — fall back to category-average heuristics or skip.
- Outlier spending (one-off ₹15k) — use median + IQR, not mean.

**19. Complexity.** Medium.
**20. Time.** **3–4 days**.

**MVP/Premium.** Premium. **Monetization:** premium upsell when the user opens "create budget".

---

## Feature 10 — Financial Health Score

**1. Overview.** A single 0–100 score derived from: budget adherence, savings rate, recurring vs discretionary ratio, expense diversification, goal progress. Shown on dashboard with trend chart and improvement tips.

**2. Business value.** Gamification. Returns the user weekly to "see if the score went up". Pairs with Insights (#8) to explain the score.

**3. User flow.**
1. Dashboard top card: score + delta vs last month.
2. Tap → score breakdown by factor + improvement tips.
3. Weekly push if score changed by ≥5.

**4. Database changes.** New `FinancialScoreSnapshot` collection (history, for trend chart).

**5. New collections.**
- `financial_scores`: `user, period: { year, month }, score, factors: { budgetAdherence, savingsRate, ...}, computedAt`.

**6. Model schema.**
- Unique `(user, period.year, period.month)`.
- Index `(user, period.year desc, period.month desc)`.

**7. API endpoints.**

| Method | Path                                       | Auth |
| ------ | ------------------------------------------ | ---- |
| GET    | `/api/v1/financial-score`                  | user (premium) |
| GET    | `/api/v1/financial-score/history`          | user (premium) |
| POST   | `/api/v1/financial-score/recompute`        | user (premium, rate-limited) |

**8. Joi validation.** Standard.

**9. Service layer.** `lib/services/ai/score.service.js` — pure deterministic, no LLM. Cron monthly recompute (1st of month for previous month).

**10. Admin panel changes.** Distribution histogram in admin dashboard (optional).

**11. Flutter screens.** Score card widget on dashboard; `financial_score_detail_screen.dart`.

**12. Flutter state.** `financialScoreProvider`, `financialScoreHistoryProvider`.

**13. Notifications.** Monthly score email + push.

**14. Security.** None new.

**15. Scalability.** Monthly per-user computation. ~50k users × ~10ms each = 8 min. Run as a sharded cron (process by user-id mod 4).

**16. Testing.** Snapshot tests against synthetic user profiles (frugal, spendthrift, balanced).

**17. Deployment.** Cron entry.

**18. Risks & edge cases.** Score volatility for low-activity users — require ≥30 expenses/month before scoring.

**19. Complexity.** Medium.
**20. Time.** **5 days**.

**MVP/Premium.** Premium. **Monetization:** core premium retention loop.

---

# PHASE 4 — Automation (Weeks 11–12)

Objective: zero manual entry for users who allow access.

---

## Feature 11 — SMS Auto Expense Detection (Android)

**1. Overview.** Android-only: with user permission, parse incoming bank/wallet SMSes (HDFC, ICICI, Paytm, GPay, etc.), extract transactions, prompt user to confirm or auto-add (per user preference). Strictly on-device parsing — SMS content NEVER leaves the device.

**2. Business value.** India-specific killer feature; most banks SMS every transaction. Eliminates manual entry for 70%+ of expenses.

**3. User flow.**
1. Settings → "Auto-detect from SMS" → request `READ_SMS` + post-notification permission.
2. On-device parser runs as a background isolate, watches new SMS.
3. Matches a known sender template → extracts `{ amount, merchant, date }`.
4. Default: drop into a "Pending review" tray (in-app notification, not push). User taps to accept (creates Expense) or dismiss.
5. Power-user: enable "auto-add for trusted senders" → expense created automatically with `source: 'sms'` flag.

**4. Database changes.** Add `Expense.source: enum('manual'|'recurring'|'sms'|'ocr'|'bank-sync')`. New `SmsParserRule` (cloud-pushed templates) optional.

**5. New collections.** `sms_parser_rules` (system-owned, cloud-pushed): `{ senderPattern, amountRegex, merchantRegex, datePattern, currency, version, isActive }`. Pulled by mobile on app start.

**6. Model schema.**
- `Expense.source` enum added.
- `sms_parser_rules` is read-only on the server side (admin manages).

**7. API endpoints.**

| Method | Path                                       | Auth |
| ------ | ------------------------------------------ | ---- |
| GET    | `/api/v1/sms-rules`                        | user (premium) |
| POST   | `/api/v1/admin/sms-rules`                  | admin (audited) |
| PATCH  | `/api/v1/admin/sms-rules/:id`              | admin (audited) |
| DELETE | `/api/v1/admin/sms-rules/:id`              | admin (audited) |

The actual SMS parsing is mobile-side; the API just ships rules.

**8. Joi validation.** Admin: `{ senderPattern, amountRegex, merchantRegex, datePattern, currency, version }`. Strict regex length + complexity caps (avoid ReDoS).

**9. Service layer.** Minimal server-side: `lib/services/smsRules.service.js` — list/CRUD. All heavy lifting is in Flutter.

**10. Admin panel changes.** `/admin/sms-rules` — full CRUD with regex playground to test against pasted SMS samples.

**11. Flutter screens.**
- `lib/features/sms_detect/presentation/permission_screen.dart`
- `lib/features/sms_detect/presentation/pending_review_screen.dart`
- `lib/features/sms_detect/presentation/sms_settings_screen.dart`
- Background isolate registered via `flutter_background_service` or `android_alarm_manager_plus`.

**12. Flutter state.** `smsParserControllerProvider` (handles permission, rule download, background service). New `pendingExpensesControllerProvider` for the review tray.

**13. Notifications.** In-app only ("3 pending transactions to review"). NEVER push the SMS content.

**14. Security.**
- SMS body never leaves the device. Strong on-device guarantee.
- Telemetry: only emit `{ ruleId, success: bool }` — no PII.
- iOS: not feasible due to platform restrictions — Android-only, behind a feature flag.
- Privacy disclosure required in Play Store listing.

**15. Scalability.** No server impact (rules are tiny). On-device: parser must be fast (<50ms per SMS) to avoid battery drain.

**16. Testing.**
- Rule-engine unit tests with a corpus of redacted real SMSes.
- Integration: SMS arrives → pending review entry appears.
- Permission denial handled gracefully.

**17. Deployment.** Android-only build flag. Rules seeded via admin panel.

**18. Risks & edge cases.**
- Play Store review scrutinizes SMS permission — must justify and provide a "core functionality requires it" video.
- False positives — always require user confirm for first 30 days before "auto-add" is offered.
- Bank changes message format — versioned rules with cloud push update.
- Spam SMS look-alikes pretending to be bank.

**19. Complexity.** High (regulatory + mobile platform).
**20. Time.** **8 days**.

**MVP/Premium.** Premium, Android-only. **Monetization:** premium upsell on Android.

---

## Feature 12 — Bank Sync Integration

**1. Overview.** Connect bank accounts via an aggregator (Plaid for US/CA/EU, Setu/Finvu for India under Account Aggregator framework). Pull transactions, dedupe against manual/SMS-imported expenses, map to categories.

**2. Business value.** The complete-automation promise. Highest LTV feature.

**3. User flow.**
1. Settings → "Connect bank" → aggregator OAuth flow in WebView.
2. Aggregator returns a token → server stores in `BankConnection`.
3. Server polls (or webhook) for transactions → creates `Expense` rows with `source: 'bank-sync'`, `externalId` for dedupe.
4. Dedupe logic: SMS-imported and bank-imported transactions in same time window with matching ₹ are merged (one wins; user can switch the "source of truth").
5. Auto-categorization via LLM (#8 infra) on first ingestion; user corrections train a per-user mapping.

**4. Database changes.** New `BankConnection` and `BankTransaction` collections. Add `Expense.externalId` (sparse unique per user) and `Expense.source`.

**5. New collections.**
- `bank_connections`: `user, provider, providerAccountId, accountMask, bankName, status, lastSyncedAt, error, accessTokenEncrypted, connectedAt`.
- `bank_transactions`: `user, connection, externalId (unique per user), amount, currency, merchant, occurredAt, type: debit|credit, raw, expenseId? (linked Expense)`.

**6. Model schema.**
- `BankConnection.accessTokenEncrypted` — encrypted with AES-256-GCM using a key from KMS / env (`BANK_TOKEN_ENC_KEY`).
- Indexes: `(user, status)`, `(user, externalId)` unique.

**7. API endpoints.**

| Method | Path                                       | Auth |
| ------ | ------------------------------------------ | ---- |
| POST   | `/api/v1/bank/connect/init`                | user (premium) |
| POST   | `/api/v1/bank/connect/exchange`            | user (premium) |
| GET    | `/api/v1/bank/connections`                 | user |
| DELETE | `/api/v1/bank/connections/:id`             | user |
| POST   | `/api/v1/bank/sync`                        | user (manual trigger, rate-limited) |
| POST   | `/api/v1/webhooks/plaid` (or `setu`)       | provider |

**8. Joi validation.** Standard provider-token shapes; webhooks verified by signature, not Joi.

**9. Service layer.** `lib/services/bank/` directory:
- `index.js` (router by provider)
- `plaid.js`, `setu.js` (adapters)
- `sync.service.js` (pull, dedupe, categorize)
- `categorizer.js` (calls LLM via `lib/services/ai/llm.js`)

Cron: hourly delta sync per active connection.

**10. Admin panel changes.** `/admin/bank-connections` — count by provider, error states, support drill-in (no token access).

**11. Flutter screens.**
- `lib/features/bank_sync/presentation/connect_screen.dart` (WebView)
- `lib/features/bank_sync/presentation/connections_screen.dart`
- `lib/features/bank_sync/presentation/sync_status_screen.dart`

**12. Flutter state.** `bankConnectionsControllerProvider`. Reuses existing expense list.

**13. Notifications.** Sync failure → in-app + email (token expired, requires re-auth). Large transaction detected → optional push.

**14. Security.**
- Tokens encrypted at rest; never logged.
- All bank-related endpoints rate-limited.
- Webhook signature verification mandatory.
- PII compliance — RBI Account Aggregator framework for India is strict; legal review required before launch.
- Audit log every bank-related mutation.

**15. Scalability.** Per-user transaction volume is modest (~50–200/month). Webhook-driven where possible; cron-poll fallback. Use bulk inserts on dedup matches.

**16. Testing.** Provider sandbox accounts. Replay tests for dedupe. Webhook idempotency.

**17. Deployment.** Secrets: `PLAID_CLIENT_ID/SECRET`, `SETU_CLIENT_ID/SECRET`, `BANK_TOKEN_ENC_KEY`. Region-aware provider routing.

**18. Risks & edge cases.**
- Provider downtime — gracefully degrade.
- Re-auth flow (tokens expire every 90 days for many providers) — push reminder before expiry.
- Wrong categorization at scale — show "Review categorization" tray for first 50 imports.
- Duplicate transactions across bank sync + SMS (#11) + manual — three-way dedupe is tricky; deterministic key: `(amount, day, merchant-normalized)`.
- Compliance: RBI AA framework (India), Plaid TOS (US), GDPR (EU).

**19. Complexity.** Very High.
**20. Time.** **10–12 days** (excluding compliance/legal).

**MVP/Premium.** Premium top-tier. **Monetization:** dedicated "Pro+" tier (₹199/month) above Premium.

---

# 11. Recommended folder additions

## Backend (`lib/`)

```
lib/
├─ services/
│  ├─ ai/
│  │  ├─ insights.service.js
│  │  ├─ score.service.js
│  │  ├─ features.js
│  │  ├─ llm.js
│  │  └─ prompts/
│  ├─ billing/
│  │  ├─ stripe.js
│  │  ├─ google.js
│  │  └─ apple.js
│  ├─ bank/
│  │  ├─ plaid.js
│  │  ├─ setu.js
│  │  ├─ sync.service.js
│  │  └─ categorizer.js
│  ├─ ocr/
│  │  ├─ vision.js
│  │  ├─ textract.js
│  │  └─ paddle.js
│  ├─ fcm.service.js
│  ├─ device.service.js
│  ├─ subscription.service.js
│  ├─ savings.service.js
│  ├─ receipt.service.js
│  ├─ smsRules.service.js
│  └─ insight.service.js
├─ models/
│  ├─ Device.js
│  ├─ SavingsGoal.js, GoalContribution.js
│  ├─ ReceiptScan.js
│  ├─ Insight.js
│  ├─ FinancialScoreSnapshot.js
│  ├─ SmsParserRule.js
│  ├─ BankConnection.js, BankTransaction.js
│  └─ WebhookEvent.js
├─ validators/
│  └─ (one per feature, mirroring services)
├─ api/
│  ├─ requirePlan.js          # premium gate
│  └─ requireVerified.js      # email-verified gate
└─ utils/
   ├─ encryption.js           # AES-GCM for bank tokens
   └─ phoneNormalize.js
```

## Mobile (`mobile-app/lib/features/`)

```
features/
├─ devices/
├─ savings/
├─ receipts/
├─ calendar/
├─ insights/
├─ financial_score/
├─ sms_detect/
├─ bank_sync/
├─ subscription/
└─ settings/
   └─ devices/
```

Plus shared:
```
core/
├─ push/push_service.dart
├─ encryption.dart
└─ plan_gate.dart    # widget wrapper for premium-gated routes
```

---

# 12. Twelve-week roadmap (calendar)

| Week | Focus                                           | Deliverables                                                                 |
| ---- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| 1    | Email Verification + Device Management start    | Verification flow live; Device model + endpoints                             |
| 2    | Device Management finish + FCM core             | Devices screen on mobile; FCM Admin SDK wired; basic push working            |
| 3    | FCM polish + Subscription Tracking start        | Push deep-links; Stripe + Google IAP webhook handlers                        |
| 4    | Subscription Tracking finish                    | Paywall live; renewal cron; admin sub management; **Phase 1 release**       |
| 5    | Savings Goals                                   | Goals CRUD + contributions + dashboard widget                                |
| 6    | Receipt OCR                                     | Upload + worker + extract + pre-fill                                         |
| 7    | Spending Calendar + Phase 2 hardening           | Calendar screen; Phase 2 stabilization; **Phase 2 release**                 |
| 8    | AI Insights pipeline                            | Feature extraction; LLM wrapper; cached insights table                       |
| 9    | Smart Budget Suggestions + Insights surfaces    | Mobile Insights screen; suggestions in budget sheet                          |
| 10   | Financial Health Score + Phase 3 hardening      | Score computation; dashboard card; **Phase 3 release**                      |
| 11   | SMS Auto-Detection (Android)                    | Permission flow; rule engine; pending review tray                            |
| 12   | Bank Sync (Plaid sandbox / Setu sandbox)        | Connect flow; sync + dedupe; admin overview; **Phase 4 beta release**       |

Buffer: Week 12+ is a 1-week stabilization sprint before Phase 4 GA, since Bank Sync needs real-bank certification.

---

# 13. Database migration plan

DET uses Mongoose, which is schemaless from MongoDB's perspective —
"migrations" here mean **(a) backfill scripts** for new fields with
defaults, and **(b) index creation**. All scripts go in `scripts/migrations/`
and follow `mmm-NNN-description.js` naming, applied in order.

| Order | Script                                | Purpose                                                                         |
| ----- | ------------------------------------- | ------------------------------------------------------------------------------- |
| 001   | `001-email-verified-backfill.js`      | Set `emailVerifiedAt = createdAt` for all existing users (grandfather them in). |
| 002   | `002-device-collection-indexes.js`    | Create `devices` indexes.                                                       |
| 003   | `003-subscription-events.js`          | Initialize `Subscription.events: []` on existing rows.                          |
| 004   | `004-notification-push-fields.js`     | Add `pushDelivery` defaults on Notification.                                    |
| 005   | `005-savings-goals.js`                | Create collection + indexes.                                                    |
| 006   | `006-receipt-scans.js`                | Create collection + indexes + TTL.                                              |
| 007   | `007-expense-source-field.js`         | Backfill `Expense.source = 'manual'` (or `'recurring'` if `recurringSource`).   |
| 008   | `008-insights.js`                     | Create collection + TTL.                                                        |
| 009   | `009-financial-scores.js`             | Create collection + indexes.                                                    |
| 010   | `010-sms-rules.js`                    | Create collection + seed default Indian-bank patterns.                          |
| 011   | `011-bank-collections.js`             | Create connections + transactions with encrypted-token field convention.        |
| 012   | `012-webhook-events.js`               | Create idempotency collection.                                                  |

**Execution rules:**
- Each script idempotent (re-runnable). Use `upsert` and `if (!field) set field`.
- Run in CI on a snapshot of prod before merging schema-touching PRs.
- Maintain a `_migrations` collection that records `{ name, appliedAt, durationMs }`.
- Index creation in production: use `background: true` (Mongoose default for 4.x+) and stage during low-traffic windows.

**Rollback:** All field additions are additive; rollback = revert the
deploy + run a script to unset the new field if necessary. Collections
created during a release can be dropped only if no documents reference
them externally; otherwise keep and ignore.

---

# 14. Release strategy

**Branching.** Trunk-based: short-lived feature branches → PR → main. Tag a release on each Phase completion (`v0.2.0` after Phase 1, etc.).

**Release channels (mobile).**
- **Internal**: every PR-merged build (Firebase App Distribution).
- **Beta**: weekly to Play Store closed track + TestFlight; ~200 users.
- **Production**: phased rollout — 5% → 25% → 50% → 100% over 7 days.

**Release channels (web/API).** Vercel preview per PR; main → production; instant rollback via Vercel "promote previous deployment".

**Feature flags.** Add `FeatureFlag` collection: `{ key, enabled, rolloutPercent, userAllowlist }`. Read by `withRoute` and exposed to mobile via `/api/v1/feature-flags`. Use for risky features (SMS detection, bank sync) — ship dark, enable per-cohort.

**Per-phase release gates.**
- Phase 1: email-verification onboarding QA on real device matrix; FCM cross-platform smoke; subscription sandbox receipts verified end-to-end.
- Phase 2: OCR accuracy ≥ 85% on 100-receipt eval set; calendar timezone correctness.
- Phase 3: LLM cost dashboard live; insight quality manual review on 50 users.
- Phase 4: SMS parser ≥ 95% precision on 1000-SMS test corpus; Bank Sync passes provider certification.

**Communication.**
- In-app changelog modal on first launch after update.
- Release notes in `CHANGELOG.md`.
- Email digest to premium users.

---

# 15. Production readiness checklist

Each feature flips the box only when ALL items are true.

**Code & Tests**
- [ ] Service tests with `mongodb-memory-server` (≥ 80% line coverage on new service).
- [ ] `withRoute` integration tests on every new route (validation, auth, rate-limit).
- [ ] Mobile widget tests for primary screens.
- [ ] Manual test pass on the device matrix (Android low-end + flagship, iOS 16 + 17).
- [ ] Load test where applicable (k6 script under `scripts/loadtest/`).

**Schema & Data**
- [ ] Indexes verified by `npm run audit:indexes`.
- [ ] Migration script committed and dry-run on prod snapshot.
- [ ] Soft-delete contract honored on new user-owned collections.
- [ ] TTL set on ephemeral collections (insights, receipts).

**Security**
- [ ] Joi validates every input path.
- [ ] No PII in logs / metrics / LLM prompts.
- [ ] Premium / verified / role gates enforced at `withRoute` level.
- [ ] Secrets added to env documentation; rotated in vault.
- [ ] Webhook signature verification for all provider callbacks.
- [ ] Encryption at rest for bank tokens.
- [ ] Rate limits on auth, billing, AI, receipt, bank endpoints.

**Observability**
- [ ] Winston structured logs on key paths (registration, payment, sync).
- [ ] Sentry hooks in place (server + mobile).
- [ ] Cost dashboard for paid services (OCR, LLM, FCM, aggregator).
- [ ] Health endpoint reports new external dependencies.

**Ops**
- [ ] Runbook entry in `docs/RUNBOOK.md`.
- [ ] Cron entries in `vercel.json` documented.
- [ ] Rollback steps tested.
- [ ] Provider sandbox credentials separate from prod.

**Mobile-specific**
- [ ] Deep links route correctly.
- [ ] Offline behavior defined (graceful "no connection").
- [ ] App size delta < 5MB per major feature.
- [ ] Permission rationale screens for camera/SMS/notifications.
- [ ] Play Store / App Store listing updated for new permissions.

**Legal / Compliance**
- [ ] Privacy policy updated for new data classes.
- [ ] Terms updated if monetization touched.
- [ ] India RBI AA + DPDP review for bank sync.
- [ ] App Store guidelines reviewed (especially IAP requirements).

---

# 16. Feature priority matrix (rationale)

| Feature                       | Priority   | Reason                                                                |
| ----------------------------- | ---------- | --------------------------------------------------------------------- |
| FCM Push                      | **High**   | Unlocks every other engagement loop; cheap to build.                  |
| Email Verification            | **High**   | Spam control + IAP prerequisite; quick win.                           |
| Device Management             | Medium     | Required for FCM; user-visible value is modest by itself.             |
| Subscription Tracking         | **High**   | Direct revenue; everything Premium gates on it.                       |
| Savings Goals                 | **High**   | Top retention driver; broad appeal.                                   |
| Receipt OCR                   | Medium     | Premium signature; high cost-to-build.                                |
| Spending Calendar             | Medium     | Quick polish win; not revenue-driving.                                |
| AI Insights                   | **High**   | Premium retention loop; reuses existing data.                         |
| Smart Budget Suggestions      | Medium     | Activates Budgets for non-users; small surface.                       |
| Financial Health Score        | Medium     | Gamification + retention; pairs with Insights.                        |
| SMS Auto-Detection            | Low        | Android-only; high Play Store risk; strong in India.                  |
| Bank Sync                     | **High**   | Highest LTV; highest complexity; longest runway.                      |

---

# 17. Open architectural decisions (decide before kicking off)

1. **OCR provider** — Google Vision (fast, paid) vs PaddleOCR self-hosted (free, ops cost). Recommendation: Google Vision for v1, evaluate self-hosting at 10k scans/month.
2. **Object storage** — Cloudflare R2 vs AWS S3. Recommendation: R2 (egress-free, S3-compatible).
3. **Bank sync provider in India** — Setu vs Finvu vs Plaid (newly available). Recommendation: Setu for MVP (better docs + sandbox).
4. **LLM provider** — Anthropic Claude (preferred, prompt caching) vs OpenAI. Recommendation: Anthropic, Haiku 4.5 for cost.
5. **Job queue** — Mongo-backed `webhook_events` + cron vs introducing Redis + BullMQ. Recommendation: stay on Mongo through Phase 3; revisit if Bank Sync needs sub-minute fan-out.
6. **Feature flag system** — Roll our own (`FeatureFlag` collection) vs GrowthBook/PostHog. Recommendation: roll our own for Phase 1, GrowthBook if it grows beyond simple flags.

---

# 18. Open follow-ups still on the table

From `ROADMAP.md`:
- **FCM push delivery** — server *and* mobile slices written. Server: `lib/services/fcm.service.js`, `notification.service.dispatch` fan-out, `Device` model, `POST /api/v1/devices`, migration `002`. Mobile: `lib/core/push/push_service.dart`, `firebase_core`+`firebase_messaging` deps, Firebase init in `main.dart`, device-register on login/register/bootstrap in `auth_controller`, push-tap deep-link routing in `core/router.dart`. **Still needed to actually fire:** see the "External setup required" table in §0.3 (FCM credentials, Firebase platform configs, `npm i` / `flutter pub get`).

After Phase 1 ships, the open follow-up list should be empty.
