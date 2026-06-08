# DET — Phase 5: Wallet-inspired feature push

Reference app: **Wallet by BudgetBakers** ([Play Store](https://play.google.com/store/apps/details?id=com.droid4you.application.wallet),
[product site](https://budgetbakers.com/en/products/wallet/), [features](https://budgetbakers.com/en/products/wallet/features/)).
Wallet is the established personal-finance leader on Play Store with millions of
installs — this phase pulls the most-loved patterns into DET while keeping our
existing architecture (Next.js + Mongo + Flutter/Riverpod).

Reads alongside [`NEXT_PHASES_PLAN.md`](./NEXT_PHASES_PLAN.md). Where Wallet
already mapped onto something we built, that row is marked `✓`. Where we have
nothing comparable, it becomes a new feature.

---

## Implementation status

| #  | Feature                              | Status        | Server | Mobile | Notes |
| -- | ------------------------------------ | ------------- | ------ | ------ | ----- |
| 13 | Accounts / Wallets                   | **Complete**  | [x]    | [x]    | Migration 012 seeds Cash + backfills Expense.account; admin at `/admin/accounts`; mobile has strip + list + detail + transfer + edit |
| 14 | Bills & Planned Payments             | **Complete**  | [x]    | [x]    | List/detail/pay/edit + upcoming-bills dashboard card + daily reminders cron + privacy-respecting admin view |
| 15 | Debts (lend / borrow)                | **Complete**  | [x]    | [x]    | Two-way ledger with partial repayments + settled detection + paired Expense rows · privacy-respecting admin at `/admin/debts` |
| 16 | Shared accounts                      | **Complete**  | [x]    | [x]    | Premium · AccountMembership collection (mig 015) · invite-by-email + lazy user creation · paired-route /accounts/:id/members and /sharing/invitations · privacy-respecting admin at /admin/shared-accounts |
| 18 | Cash-flow forecast                   | **Complete**  | [x]    | [x]    | Premium dashboard card · 30-day history + 30-day forecast line chart · low-point warning |
| 19 | Home-screen widgets                  | **Complete**  | [x]    | [x]    | Android 2x2 widget (`DetBalanceWidgetProvider`) shows net-worth + today's spent + "+ Add" tap-back; Flutter publishes formatted strings on every dashboard fetch via `HomeWidgetService`; iOS WidgetKit deferred — add when shipping to iOS |
| 22 | Auto-categorise on add               | **Complete**  | [x]    | [x]    | Per-user Naive Bayes trained on last 500 notes; "Suggested" badge in the add-expense category strip; never leaves user data boundary |
| 23 | Onboarding + Google + Magic-link     | **Complete\*\***| [x]    | [x]    | Needs `GOOGLE_CLIENT_ID` + `npm i google-auth-library` for Google; magic link works as soon as SMTP is configured |

> Feature IDs 17 (Investments), 20 (Voice input), and 21 (Consumer web app)
> have been **removed from scope** for Phase 5. IDs are kept for traceability
> against earlier commits / discussions — they will not be revisited unless
> explicitly re-added.

---

## 0. Gap analysis — Wallet ↔ DET

| Wallet feature                          | DET status today                                                                          | Action |
| --------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| Multi-currency                          | Per-user currency only; expense.currency stored but no FX                                 | **Extend** — proper Account-level currency + display conversion |
| **Accounts / wallets** (Cash, Card, …)  | Not modelled. Expenses have `paymentMethod` string but no real Account entity             | **NEW — Feature 13** |
| Bank sync (15k+ banks)                  | Server scaffolded (Plaid + Setu adapters), mobile deferred                                | ✓ Continue |
| Smart budgets + category limits         | Already shipped (per-category, monthly/yearly)                                            | ✓ — add account scoping in 13 |
| **Bills / Planned payments**            | Recurring expenses materialise as Expense rows. No "upcoming bills" calendar view.        | **NEW — Feature 14** |
| **Debts (lend / borrow)**               | Not modelled                                                                              | **NEW — Feature 15** |
| **Shared accounts / group expenses**    | Not modelled. Every record is single-user.                                                | **NEW — Feature 16** |
| Investments / stock portfolio           | Not modelled                                                                              | **Out of scope** |
| Custom categories + icons               | Shipped                                                                                   | ✓ |
| Reports + charts                        | Shipped (analytics screen redesign just landed)                                           | ✓ |
| Cash-flow forecast                      | Not done. Insights only look backward.                                                    | **NEW — Feature 18** |
| **Home-screen widgets** (Android/iOS)   | Not done                                                                                  | **NEW — Feature 19** |
| Wear OS / watch app                     | Not done                                                                                  | Out of scope |
| Voice input ("Spent 250 on coffee")     | Not done                                                                                  | **Out of scope** |
| Consumer web app                        | Admin panel only.                                                                         | **Out of scope** (mobile-first) |
| Push notifications                      | Shipped (FCM)                                                                             | ✓ |
| AI insights / categorisation suggest    | Insights shipped. Auto-categorise on add not wired.                                       | **Extend — Feature 22** |

---

## 0.1 Phase 5 feature priority matrix

| #  | Feature                              | Priority   | MVP/Premium | Complexity | Why                                  |
| -- | ------------------------------------ | ---------- | ----------- | ---------- | ------------------------------------ |
| 13 | **Accounts / Wallets**               | **HIGH**   | MVP         | High       | Foundational — unblocks 14–18, 21    |
| 14 | Bills & Planned Payments             | **HIGH**   | MVP         | Medium     | Wallet's killer "never miss a bill"  |
| 15 | Debts (lend / borrow)                | Medium     | MVP         | Medium     | Wallet's most-requested tab          |
| 16 | Shared accounts                      | **HIGH**   | Premium     | High       | Network-effect — partners / families |
| 18 | Cash-flow forecast                   | Medium     | Premium     | Medium     | Pairs with AI insights               |
| 19 | Home-screen widgets                  | Medium     | MVP         | Medium     | Daily-engagement multiplier          |
| 22 | Auto-categorise on add               | Medium     | MVP+Premium | Low        | UX win, premium upsell for ML model  |

---

## 0.2 Dependency graph

```
                          ┌──────────────────────────┐
                          │ #13  Accounts / Wallets  │
                          └────────────┬─────────────┘
                                       │
                ┌─────────────────┬────┴─────┬─────────────────┐
                ▼                 ▼          ▼                 ▼
        ┌─────────────┐   ┌───────────┐ ┌─────────┐    ┌─────────────┐
        │ 14 Bills /  │   │ 15 Debts  │ │ 16 Share│    │ 18 Forecast │
        │   Planned   │   │           │ │   Acc.  │    │ (consumes   │
        └──────┬──────┘   └───────────┘ └─────────┘    │  14 + 13 +  │
               │                                       │  analytics) │
               └─────────────► 18 ◄───────────────────►└─────────────┘

  ┌─────────────┐   ┌──────────────────────┐
  │ 19 Widgets  │   │ 22 Auto-categorise  │
  │ (any phase) │   │ (any phase)          │
  └─────────────┘   └──────────────────────┘
```

---

# Feature 13 — Accounts / Wallets *(foundational)*

**1. Overview.** Promote `paymentMethod` from a free-text string into a real
`Account` entity. Every expense, contribution, bill payment, debt repayment
and (future) investment transaction is linked to exactly one Account. Users
can create accounts of types: `cash`, `bank`, `credit_card`, `wallet` (UPI /
Paytm / digital wallet), `savings`, `loan`. Each account has a name, icon,
color, currency, starting balance, and optional account number (last-4 mask
only).

**2. Business value.** Without this, users can't answer "how much do I have in
my HDFC card vs cash". This is THE Wallet differentiator — every screen they
ship is account-scoped.

**3. User flow.**
1. On first login (or migration), DET creates a default "Cash" account so
   existing expenses still render.
2. Profile → Accounts → "+ Add account" — pick type, name, currency, opening
   balance, color, icon.
3. Dashboard gains a horizontal "Accounts" strip — each account chip shows
   current balance. Tapping drills into a per-account expense list.
4. Add-expense sheet gains an "Account" picker (between Category and Payment
   method). The old `paymentMethod` field becomes a tag inside the account
   record (e.g., a "Card" account knows whether it's credit or debit).
5. Net worth ribbon on Home: sum of all accounts in the user's display
   currency.

**4. Database changes.**
- New `accounts` collection.
- `Expense.account: ObjectId` (required after migration). Existing rows
  backfill to the default Cash account.
- `Subscription.account: ObjectId?` (premium auto-debit account).
- `SavingsGoal.fundingAccount: ObjectId?`.

**5. New collections — `accounts`:**

| Field            | Type        | Notes                                      |
| ---------------- | ----------- | ------------------------------------------ |
| `user`           | ObjectId    | indexed                                    |
| `name`           | String      | "Cash", "HDFC Debit", "Paytm"              |
| `type`           | Enum        | cash / bank / credit_card / wallet / savings / loan |
| `icon`           | String      | material icon name                         |
| `color`          | String      | hex                                        |
| `currency`       | Enum (CURRENCIES) |                                      |
| `openingBalance` | Number      | seed value at account creation             |
| `accountMask`    | String      | last-4 of card / account number (optional) |
| `isArchived`     | Boolean     | hide from active list, keep history        |
| `excludeFromTotals` | Boolean  | for loan accounts user wants to hide       |
| `sortOrder`      | Number      | user-controlled reorder on the strip       |

Indexes: `(user, isArchived, sortOrder)`.

**6. Computed fields.** `currentBalance` derived at read time:
`openingBalance + Σ(credit txns) − Σ(debit txns)`. Cached on the document
with a version counter so reads stay O(1); the counter bumps on every
related write.

**7. API endpoints.**

| Method | Path                                   | Auth |
| ------ | -------------------------------------- | ---- |
| GET    | `/api/v1/accounts`                     | user |
| POST   | `/api/v1/accounts`                     | user |
| GET    | `/api/v1/accounts/:id`                 | user |
| PATCH  | `/api/v1/accounts/:id`                 | user |
| DELETE | `/api/v1/accounts/:id` (soft, archive) | user |
| POST   | `/api/v1/accounts/:id/transfer`        | user — internal transfer |
| GET    | `/api/v1/accounts/net-worth`           | user |

**8. Joi validation.** Standard CRUD; `openingBalance` allows negative for
credit cards; `accountMask` regex `^\d{2,4}$`.

**9. Service layer.** New `lib/services/account.service.js` — CRUD,
balance computation, transfer (creates two paired Expense rows with
`source: 'transfer'`).

**10. Admin panel changes.** New `/admin/accounts` page — aggregate by
type, top users by account count. Useful for support ("user reports
balance mismatch").

**11. Flutter screens.**
- `lib/features/accounts/presentation/accounts_screen.dart` (list)
- `lib/features/accounts/presentation/account_detail_screen.dart`
  (balance + transactions tab + edit)
- `lib/features/accounts/presentation/edit_account_sheet.dart`
- `lib/features/accounts/presentation/transfer_sheet.dart`
- `widgets/accounts_strip.dart` — horizontal scrolling chip strip on the
  dashboard (matches Wallet's home).

**12. Flutter state.** `accountsControllerProvider` (AsyncNotifier), used by
add-expense, dashboard strip, transfer sheet, and account detail.

**13. Migration plan.**
- `012-accounts.js`: create the collection, seed a default Cash account per
  user, set `Expense.account` to the seeded Cash for all existing rows,
  build indexes.

**14. Risks.**
- Backwards compatibility: every existing screen that touched `paymentMethod`
  needs an update path. The string field stays on Expense (deprecated, kept
  for analytics) for one full release cycle, then dropped.
- Transfer dedupe: a transfer is two Expense rows linked via `transferPair`;
  analytics and budget alerts must exclude them or they double-count.

**15. Time.** **8–10 days** (server + mobile + migration + tests).

---

# Feature 14 — Bills & Planned Payments

**1. Overview.** Distinct from RecurringExpense (which auto-materialises a real
Expense on schedule). A Bill is "I expect to pay ₹X to Y by date Z" — it's a
*future obligation* with a due date. When the user pays, they mark the Bill as
paid, which converts it into an Expense linked back. Unpaid bills past their
due date go into "overdue" state.

**2. User flow.**
1. Profile → Bills → "+ Add bill" — name, amount, currency, due date,
   account, category, optional auto-pay flag.
2. Home → new "Upcoming bills" card showing next 7 days, with overdue badges.
3. Tap a bill → "Mark paid" → opens a pre-filled add-expense sheet.
4. T-3 / T-1 / day-of push reminders.
5. Recurring bills auto-create the next instance on payment.

**3. Database changes.** New `bills` collection.

| Field           | Type        | Notes |
| --------------- | ----------- | ----- |
| `user`          | ObjectId    | |
| `name`          | String      | "Electricity — March" |
| `amount`        | Number      | expected; user can adjust on pay |
| `currency`      | Enum        | |
| `account`       | ObjectId    | suggested payment account |
| `category`      | ObjectId    | |
| `dueDate`       | Date        | indexed |
| `paidAt`        | Date?       | null = unpaid |
| `paidExpense`   | ObjectId?   | back-link once converted |
| `recurrence`    | Enum?       | monthly/quarterly/yearly/none |
| `nextInstance`  | ObjectId?   | forward-link in the chain |
| `autoPay`       | Boolean     | informational (we don't actually pull) |
| `notes`         | String      | |

**4. Endpoints.** Standard CRUD + `POST /bills/:id/pay` (atomic
mark-paid + create-expense + advance recurrence).

**5. Cron.** `/api/cron/bills` daily — fires T-3 / T-1 / day-of push,
flips `overdue` flag.

**6. Mobile.** `lib/features/bills/` with list, detail, pay sheet, dashboard
"Upcoming" card.

**7. Time.** **4–5 days**.

---

# Feature 15 — Debts

**1. Overview.** Two-way ledger: "I owe X ₹Y" (borrowed) or "X owes me ₹Y"
(lent). Multiple repayments per debt; each repayment is an account transfer
(money leaves your Cash → goes to debt-payment) plus a status update on the
debt row.

**2. User flow.**
1. Profile → Debts → "+ Add debt" — type (lent/borrowed), counterparty
   name, amount, account, currency, due date, note.
2. Each debt has a running "settled / outstanding" pill and a list of
   repayments.
3. "Record repayment" sheet — partial or full settle.
4. Insights: "₹5,000 outstanding across 3 debts" card on home (premium).

**3. New collections.**
- `debts`: `{ user, type, counterparty, amount, currency, account,
   outstanding, dueDate?, note, settledAt? }`
- `debt_repayments`: `{ user, debt, amount, occurredAt, account, expenseId }`

**4. Endpoints.** CRUD + `POST /debts/:id/repay`.

**5. Time.** **4 days**.

---

# Feature 16 — Shared accounts *(shipped)*

**1. Overview.** Premium-only. Account-level multi-user collaboration: the
owner invites by email, the invitee accepts, and both then see every
expense booked on the account. Budgets on shared accounts apply to the pool
because balance recompute aggregates by `account` (not by `user`).

**2. User flow.**
1. Account detail → Members icon → "+ Invite" sheet (premium-gated). Enter an
   email; if the address doesn't have a DET account yet, the server
   lazy-creates a passwordless row that the invitee claims on first sign-in.
2. Invitee gets an in-app push (`/shared/invitations` deep-link) plus an
   email. The Accounts screen badges the inbox icon with a pending count.
3. Tap accept → the shared account appears in their list with a "Shared"
   pill; tap decline → row drops off their inbox.
4. Member view of a shared account omits Edit / Archive / Transfer
   controls — those stay owner-only. Members can self-leave via the same
   revoke endpoint owners use to kick.

**3. Database — `account_memberships` (mig 015).**

| Field           | Type        | Notes                                                  |
| --------------- | ----------- | ------------------------------------------------------ |
| `account`       | ObjectId    | indexed                                                |
| `user`          | ObjectId    | indexed                                                |
| `role`          | Enum        | `owner` \| `member` (no editor/viewer split — kept tight) |
| `status`        | Enum        | `pending` \| `active` \| `declined` \| `revoked`       |
| `invitedBy`     | ObjectId    | for the audit trail                                    |
| `invitedAt`     | Date        | drives "stale pending" admin signal                    |
| `acceptedAt`    | Date?       |                                                        |
| `revokedAt`     | Date?       |                                                        |
| `revokedReason` | String      | internal; never shown to the other party               |

Unique `(account, user)` lets a re-invite of a declined / revoked user
flip the existing row's `status` back to `pending` rather than mint a new
one. Lookup indexes `(user, status)` and `(account, status)`.

**4. Endpoints.**

| Method | Path                                              | Purpose                                |
| ------ | ------------------------------------------------- | -------------------------------------- |
| GET    | `/api/v1/accounts/:id/members`                    | Owner + active/pending members         |
| POST   | `/api/v1/accounts/:id/members`                    | Invite by email (premium-gated)        |
| DELETE | `/api/v1/accounts/:id/members/:membershipId`      | Owner kick OR member self-leave        |
| GET    | `/api/v1/sharing/invitations`                     | Pending invitations addressed to caller |
| POST   | `/api/v1/sharing/invitations/:id/accept`          |                                        |
| POST   | `/api/v1/sharing/invitations/:id/decline`         |                                        |

**5. Visibility.** `sharing.service.accessibleAccountIds(userId)` returns
the union of owned accounts + active-member accounts. Used by
`account.service.list/get` and `expense.service.buildListFilter`, so
every list endpoint naturally surfaces shared rows without each call
site re-implementing the OR.

**6. Privacy boundary (admin).** `/admin/shared-accounts` shows only
aggregates: status counts, role counts, distinct shared-account count,
average members per shared account, stale-pending (>14d) count. No
emails, no account names — same bar as the rest of the admin panel.

**7. Risks resolved.**
- Owner-rename race: ownership transfer not supported in v1; if needed,
  add as a separate endpoint that updates `account.user` + flips the
  matching membership rows in a transaction.
- Email enumeration: the invite endpoint returns the same shape whether
  the address pre-existed, matching the magic-link auth response.

**8. Time.** **5 days** (delivered).

---

# Feature 18 — Cash-flow forecast *(shipped)*

**1. Overview.** Premium dashboard card that composes four data sources
into a single 60-day picture: 30 days of historical running balance on
the left and a 30-day dashed forecast on the right. A low-point warning
chip surfaces when the projection dips below zero.

**2. Composition.**
- **Accounts** → starting balance (sum of `cachedBalance` across active
  accounts in the user's display currency).
- **Bills** due in the window → debit on each due date (Feature 14).
- **Recurring expenses** → debit on each materialisation date (existing).
- **Savings auto-contributions** → debit on each scheduled date (existing).
- **Discretionary spending** → daily average from the last 30 days,
  applied uniformly to fill the gaps.

**3. Implementation.** `lib/services/ai/forecast.service.js` on the
server; `mobile-app/lib/features/forecast/` on the client. fl_chart
LineChart with a solid history line + dashed forecast line; both
gradient-filled so the visual stays calm at small sizes.

**4. Privacy.** Free users don't see the card at all (premium-gated
provider). Forecast never narrates per-row — it's a single line chart
with a "below zero on date X" pill, no AI text generation involved.

**5. Time.** **3 days** (delivered).

---

# Feature 19 — Home-screen widgets *(shipped — Android)*

**1. What landed.** A single 2×2 (resizable) Android widget that shows
net worth + today's spending + an "+ Add" tap-pill. We deliberately
shipped one solid widget instead of three half-baked sizes; more sizes
can be added by registering more `AppWidgetProvider` classes and layouts
against the same data channel.

**2. Architecture.**
- **No server endpoint.** Earlier plan called for `/api/v1/widgets/summary`
  authenticated by refresh token. We dropped it — the Flutter app already
  fetches everything the widget needs on dashboard refresh, so the
  cheapest design is to publish the formatted strings from Dart to
  SharedPreferences via `home_widget`, and let the native widget read
  from there. That removes a whole network round-trip, a token-storage
  hop, and a background-fetch headache.
- **Dart bridge** — `lib/core/home_widget_service.dart`. `publish()` writes
  `widget.balance / widget.todaySpent / widget.currency / widget.updatedAt /
  widget.signedIn` and pings the AppWidgetProvider so the launcher
  redraws immediately. Called from `DashboardNotifier` after every
  fetch. `clear()` wipes the data on `logout()` so the widget shows
  "Tap to sign in" instead of the previous user's numbers.
- **Android widget** — `com.det.app.DetBalanceWidgetProvider` reads
  `HomeWidgetPlugin.getData(context)`. Layout `det_balance_widget.xml`
  with brand-gradient background (#5B7CFA). Whole widget tap opens the
  dashboard via `det://launch?screen=dashboard`; "+ Add" tap goes to
  `det://launch?screen=add-expense`. MainActivity gets a new
  `<data scheme="det" host="launch">` intent-filter; the Flutter
  router's `HomeWidget.widgetClicked` listener translates the screen
  query into a `router.go('/?widget=add-expense')`, and HomeShell
  catches the query and pops the add-expense sheet once.
- **No periodic update.** `updatePeriodMillis=0` — the system minimum
  is 30 min anyway, and we push updates from Flutter every time the
  dashboard data changes. Saves battery.

**3. Deferred.**
- **iOS WidgetKit.** Same Dart bridge applies — `HomeWidget.setAppGroupId`
  is already wired with `group.com.det.app`. Native side is a Swift
  WidgetKit target reading `UserDefaults` keyed `widget.balance` etc.
  Easy add when shipping to App Store.
- **Larger / smaller sizes.** Drop a new layout XML + AppWidgetProvider;
  the data channel is shared.

**4. Time.** **2 days** (delivered, Android only).

---

# Feature 23 — Onboarding + Google Sign-In + Magic-link auth *(shipped)*

**1. Overview.** A polished first-launch experience matching what users
expect from Play Store finance apps. **Passwordless from day one.**

- **Onboarding slider** before the auth screen — 4 swipe pages explaining
  what DET does (track spending, budgets, AI insights, premium bank sync).
  Shown only on first launch; persisted via `shared_preferences` so
  subsequent launches go straight to auth.
- **Google Sign-In** as one option — one-tap; the Google account's
  verified email becomes the DET email and is verified out of the box.
- **Magic-link email** as the other option — user enters their email,
  receives a sign-in link, taps it, and lands signed in. No password to
  remember, no password to enter. Lazy-creates the account if the email
  is new, so it covers both "register" and "login" in a single flow.

**2. User flow.**

```
First launch (no token):
   Onboarding (4 swipe pages) → "Get started"
      ↓
   /auth screen
      ├── "Continue with Google" → home (instantly verified)
      └── "Continue with email"
            ↓
         "Check your inbox" — server sent a one-shot sign-in link
            ↓
         (user taps link in their email)
            ↓
         /auth/sign-in?token=… → exchanges token for DET tokens → home

Subsequent launches: skip onboarding; go straight to /auth (if logged out)
or home (if a valid refresh token is present).
```

**3. Database changes.**
- `User.password` is now optional (was required) — passwordless rows
  exist without one. Admins keep their passwords for the admin panel.
- `User.signInToken / signInTokenExpires / signInTokenSentAt` — magic
  link state, sha256-hashed at rest, same pattern as the existing
  password-reset / email-verification fields.
- `User.googleSub: String?` (sparse-unique) — Google's stable `sub`
  claim, links Google identity to either a fresh or existing email row.

**4. New API endpoints.**

| Method | Path                                  | Purpose                                                                 |
| ------ | ------------------------------------- | ----------------------------------------------------------------------- |
| POST   | `/api/v1/auth/google`                 | Exchange a Google ID token for DET access+refresh tokens                |
| POST   | `/api/v1/auth/email-link`             | Request a magic sign-in link (lazy-creates account if new)              |
| POST   | `/api/v1/auth/email-link/verify`      | Exchange the magic-link token for DET access+refresh tokens             |

`/api/v1/auth/login` and `/api/v1/auth/register` still exist for back-compat
(admin login path uses them, plus any legacy clients) but the consumer UI
no longer calls them.

**5. Service layer.**
- `auth.service.googleSignIn(idToken)` — verify with Google's hosted JWKS
  via `google-auth-library`, upsert by `googleSub` first then by email,
  stamp `emailVerifiedAt` since Google has already verified.
- `auth.service.requestMagicLink({ email, name? })` — lazy-create user if
  needed, generate sha256-hashed token (15-min TTL), dispatch via
  `mailer.sendMagicLinkEmail`. Response is identical regardless of whether
  the email pre-existed so the endpoint can't be used to enumerate users.
- `auth.service.verifyMagicLink({ token })` — constant-time hash compare,
  clear the token (one-shot), stamp `emailVerifiedAt` (tapping the link
  proves inbox ownership), issue the token pair.

**6. Mobile screens / state.**
- `features/onboarding/` — `OnboardingController` (shared_preferences
  flag) + 4-page `OnboardingScreen` with animated page indicator.
- `features/auth/presentation/sign_in_screen.dart` — single passwordless
  entry point. Replaces the old separate login + register screens (which
  now redirect to `/auth` for back-compat).
- `features/auth/presentation/check_email_screen.dart` — "We sent a link
  to ___" with 60s resend cooldown.
- `features/auth/presentation/magic_link_landing_screen.dart` — lands on
  the `/auth/sign-in?token=…` deep link, exchanges, routes home.
- `widgets/google_sign_in_button.dart` — branded Google glyph button,
  shows friendly "not configured" snack until `GOOGLE_SIGN_IN_SERVER_CLIENT_ID`
  dart-define is set.

**7. Security.**
- Google ID token verified against Google's hosted JWKS — never trust the
  `email` claim without verifying the signature first.
- Magic-link token sha256-hashed at rest, 15-minute TTL, one-shot.
- Same `delivered: true` response on `email-link` regardless of whether
  the user existed — no enumeration oracle.
- Rate limits: 10/15min on link request, 20/15min on link verify.

**8. External setup.**
- Server: `npm install` picks up `google-auth-library` (added to
  `optionalDependencies`). Set `GOOGLE_CLIENT_ID` to the Web client ID
  from your Google Cloud project. SMTP must be configured (already
  documented elsewhere) for the magic-link email to land in inboxes.
- Mobile: `flutter pub get` picks up `google_sign_in: ^6.2.1`. Pass the
  same Web client ID at build time:
    `flutter run --dart-define=GOOGLE_SIGN_IN_SERVER_CLIENT_ID=<id>`
  Android: register your debug + release SHA-1 in the Google Cloud Console.
  iOS: drop the reversed-client-id URL scheme into `Info.plist`.

**9. Complexity.** Medium.  **10. Time.** **3 days** (delivered).

**MVP/Premium.** MVP — friction reduction for all users.

---

# Feature 22 — Auto-categorise on add

**1. Overview.** When the user types a note in the add-expense sheet, a
small per-user model suggests a category based on the merchant/note text
matched against their history. Premium tier swaps the local model for
the Anthropic narration pipeline.

**2. Implementation.**
- Free tier: Naive Bayes trained per-user on (note → category) from last
  500 expenses. Updates online as the user logs more.
- Premium tier: same call as AI Insights, with a tighter prompt.

**3. Time.** **3 days**.

---

# Calendar — actual sequence (all delivered)

| Order | Feature                                 | Output                                                          |
| ----- | --------------------------------------- | --------------------------------------------------------------- |
| 1     | **#23 Onboarding + Google + Magic-link** ✓ | passwordless auth, onboarding slider                          |
| 2     | **#13 Accounts** ✓                      | server + mobile + admin                                         |
| 3     | **#14 Bills** ✓                         | list / detail / pay / reminders                                 |
| 4     | **#15 Debts** ✓                         | lend / borrow ledger + paired Expense rows                      |
| 5     | **#22 Auto-categorise** ✓               | per-user Naive Bayes on the add-expense sheet                   |
| 6     | **#18 Cash-flow forecast** ✓            | premium dashboard card with 60-day chart                        |
| 7     | **#16 Shared accounts** ✓               | account_memberships + invite-by-email + privacy admin           |
| 8     | **#19 Home-screen widgets** ✓           | Android 2×2 widget; iOS deferred                                |

Phase 5 closed.

---

# UI / UX patterns to adopt from Wallet

1. **Account chips on home.** Horizontal strip at the top of the dashboard
   showing each account with current balance. Tap to drill in. (Currently
   the dashboard has a single hero card — accounts deserve top billing
   because they're how users mentally split their money.)

2. **Records tab feel.** The "Expenses" tab today is a paginated list;
   Wallet styles it as a chronological feed with sticky date headers and
   subtle dividers between days. Lower visual noise.

3. **Calendar-first input alternative.** Some users prefer to navigate the
   calendar and tap a date to log. The Spending Calendar (Feature 7) is
   read-only today — add tap-to-add on a day cell.

4. **Visual category coverage.** Wallet uses big colored category icons
   on the records feed. Our list shows a small avatar — increase to
   ~36px circles with the category color as a tinted background.

5. **Net-worth ribbon.** Persistent strip below the AppBar on Home
   showing total net worth (sum across accounts). One-tap toggle to
   hide/show (some users dislike a big number on screen in public).

6. **"What's coming" forward view.** The dashboard today is all about
   the past. Wallet's edge is showing what's *coming* — upcoming bills,
   planned payments, projected end-of-month balance. Feature 18 + 14
   surface this directly.

7. **Action sheets over screens.** Wallet uses bottom sheets for
   add/edit on almost everything. DET already does this for expenses;
   extend to accounts, bills, debts.

8. **Slim FAB menu.** Wallet's FAB expands into multiple quick actions
   (expense / income / transfer). We can do the same once Accounts ship.

---

# Resolved decisions

1. **Currency story** — stays single display currency for v1. Multi-currency
   net worth with daily FX is a separate phase; the Account model already
   stores per-account currency so the data model is FX-ready.
2. **Bank sync / Accounts alignment** — yes. Plaid + Setu adapters will
   upsert into `accounts` with a `provider: 'plaid' | 'setu'` tag on the
   row when sync work resumes; nothing about the current Account schema
   blocks that.
3. **Shared accounts pricing** — premium-only for the owner (inviter).
   Invitees can be on any tier; they see whatever shared accounts they've
   accepted with no upsell. Matches the "creator pays, viewer free" model
   that worked for Wallet.

---

# Phase 5 — closed

Every in-scope feature shipped:

| #  | Feature                          | Done |
| -- | -------------------------------- | ---- |
| 13 | Accounts / Wallets               | ✓    |
| 14 | Bills & Planned Payments         | ✓    |
| 15 | Debts                            | ✓    |
| 16 | Shared accounts                  | ✓    |
| 18 | Cash-flow forecast               | ✓    |
| 19 | Home-screen widgets (Android)    | ✓    |
| 22 | Auto-categorise on add           | ✓    |
| 23 | Onboarding + Google + Magic-link | ✓    |

Removed from scope: **#17** (Investments), **#20** (Voice input),
**#21** (Consumer web app). IDs preserved for traceability only.

Deferred follow-ups (not Phase 5 work, but written down so they don't
get lost):

- iOS WidgetKit target for Feature 19. Dart bridge is already
  cross-platform; native side needs ~half a day on a Mac.
- Multi-currency net-worth (decision #1 above).
- Plaid / Setu sync writes into `accounts` (decision #2 above).
- Ownership transfer on shared accounts (Feature 16 v1 only supports
  invite / accept / kick / self-leave).

Pick the next phase or specific follow-up when you're ready.
