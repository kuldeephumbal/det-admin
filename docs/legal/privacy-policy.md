---
title: Privacy Policy
appName: DET
lastUpdated: 2026-05-28
effectiveDate: 2026-05-28
contactEmail: support@det.app
---

# Privacy Policy

**Last updated: 28 May 2026**

This Privacy Policy describes how **DET** ("we", "us", "our") collects,
uses, and shares information about you when you use the DET mobile
application and related services (collectively, the "Service").

If you do not agree with this policy, please do not use the Service.

---

## 1. Information we collect

We collect only what we need to run the Service. We don't sell your
data, and we don't profile you for advertising.

### 1.1 Information you give us

- **Account details** — your email address, and your name if you choose
  to provide it. If you sign in with Google, we receive your email and
  basic profile information (name, profile picture URL) from Google.
- **Financial data you log** — expenses, income, accounts, budgets,
  bills, debts, savings goals, recurring schedules, categories, and any
  notes or attachments you add to them. This data is *user-generated*
  and stays scoped to your account.
- **Shared-account participation** — if you accept an invitation to a
  shared account, the account owner can see expenses you log on that
  account (this is the entire point of the shared-accounts feature).

### 1.2 Information collected automatically

- **Device & diagnostics** — app version, OS version, device model,
  language, and crash / error reports (via Sentry). Crash reports do
  not include your financial data.
- **Push tokens** — if you allow notifications, we store the Firebase
  Cloud Messaging (FCM) token associated with your device so we can
  deliver bill reminders, budget alerts, and shared-account invites.
- **Sign-in sessions** — refresh tokens used to keep you signed in.
  Stored in the device's secure storage and on our servers (hashed).
- **Usage signals** — aggregated, non-identifying metrics about
  feature use (e.g. "X% of users opened the Insights tab this week")
  to help us prioritise improvements.

### 1.3 What we do NOT collect

- We do **not** access your contacts, photos, microphone, or precise
  location.
- We do **not** read your SMS messages or banking-app screens. If you
  use the optional Bank Sync feature, your bank credentials are
  handled by our regulated provider (see §3) and never reach our
  servers.
- We do **not** sell your data to anyone.

---

## 2. How we use your information

| Purpose | Examples |
| --- | --- |
| **Provide the Service** | Authenticate you, sync your data across devices, calculate totals, render charts |
| **Send notifications** | Bill reminders, budget alerts, shared-account invitations, AI insight digests |
| **Improve the Service** | Diagnose crashes (Sentry), measure feature adoption in aggregate |
| **Premium features** | Generate AI-narrated insights via Anthropic, run the financial-health score, deliver cash-flow forecasts |
| **Security** | Detect refresh-token reuse, rate-limit abusive requests, audit admin actions |

We do **not** use your data for advertising, training third-party AI
models on your behalf, or any other purpose not listed here.

---

## 3. Third parties we share with

We share data only with the service providers needed to run DET. Each
provider receives the minimum necessary information, and each is
contractually bound to use it only for the listed purpose.

| Provider | Purpose | Data shared |
| --- | --- | --- |
| **Google (Sign-In)** | Verify your Google identity at sign-in | Your Google ID token (verified server-side) |
| **Firebase Cloud Messaging** | Deliver push notifications | Device push token + the notification payload (e.g. "Electricity bill due tomorrow") |
| **Anthropic** *(Premium only)* | Generate AI-narrated insights from your spending summaries | Aggregated category totals and merchant names; never your individual transactions |
| **Sentry** | Crash and error reporting | App version, stack trace, hashed user id; financial data is excluded by configuration |
| **Plaid / Setu** *(if you enable Bank Sync)* | Securely fetch your bank transaction history | Your bank account credentials are entered directly into the provider's flow and never reach us; we receive only the resulting transactions |
| **Stripe / Google Play Billing / App Store** *(if you subscribe)* | Process subscription payments | Your name, email, and payment method, as required by the processor |

We do **not** share your data with advertisers, data brokers, or
analytics resellers.

---

## 4. Where your data is stored

- DET stores your data on **MongoDB Atlas** servers hosted in the
  region nearest to most of our users. Data is encrypted at rest using
  AES-256 and encrypted in transit using TLS 1.2+.
- Passwords (when used) are hashed with bcrypt; refresh tokens, magic
  sign-in tokens, and Plaid/Setu access tokens are hashed (SHA-256) at
  rest.
- Backups are encrypted and retained for 30 days.

---

## 5. Your rights

You can exercise the following rights at any time. To do so, use the
in-app controls described below or email
[support@det.app](mailto:support@det.app).

- **Access** — Profile → Settings → Account → Export your data
  *(coming soon)*. We will respond to access requests within 30 days.
- **Correction** — Edit any record directly in the app, or email us if
  a record is something the app doesn't let you change.
- **Deletion** — Profile → Settings → Account → Delete account
  *(coming soon)*. Deleting your account permanently erases your
  personal data within 30 days. Aggregate, anonymised analytics that
  cannot be linked back to you may be retained.
- **Withdraw consent** — You can disable notifications, disconnect
  Google sign-in, or revoke Bank Sync permissions at any time from the
  Settings screen.
- **Data portability** — On request we will provide a JSON export of
  your data.
- **Object / restrict** — Email us and we will pause or limit specific
  processing where the law allows.

For users in the **EU/EEA, UK, or Switzerland**: the legal basis for
processing your data is your consent (for optional features) or our
performance of the contract you accept by signing up (for the core
service). You have the right to lodge a complaint with your local data
protection authority.

For users in **California, USA**: the CCPA gives you the rights above
plus the right to know what categories of personal information we
collect and the right to non-discrimination for exercising your
rights. We do not "sell" personal information as defined by the CCPA.

---

## 6. Data retention

- **Active accounts** — your data is retained for as long as your
  account is active.
- **Inactive accounts** — accounts with no sign-in for 24 months are
  flagged for deletion after a final reminder email; data is purged
  60 days after the reminder.
- **Deleted accounts** — personal data is purged within 30 days of
  deletion. Audit logs and aggregated analytics may be retained for up
  to 12 months for security and compliance.
- **Logs** — server logs are retained for 90 days; access logs for
  authentication events for 12 months.

---

## 7. Children's privacy

DET is not directed to children under **13** (or the equivalent age in
your jurisdiction). We do not knowingly collect data from children
under that age. If you believe a child has signed up, please email
[support@det.app](mailto:support@det.app) and we will delete the
account.

---

## 8. International transfers

If you access DET from outside the country where our servers are
hosted, your data will be transferred across borders. For users in
the EU/EEA, transfers are protected by Standard Contractual Clauses
where required.

---

## 9. Security

We protect your data with industry-standard measures:

- TLS 1.2+ for all network traffic
- Encryption at rest for the database and backups
- Bcrypt password hashes and SHA-256 token hashes
- Refresh-token rotation with reuse detection
- Rate limiting on authentication endpoints
- Strict role-based access controls inside DET (admins cannot see
  individual users' financial data — see admin policy on the support
  page)
- Annual review of our security posture

No system is 100% secure. If you suspect unauthorised access to your
account, contact us immediately.

---

## 10. Changes to this policy

We may update this policy. When we do, we will:

- Update the **Last updated** date at the top.
- For material changes, notify you in-app and / or by email at least
  30 days before the change takes effect.

Continued use of the Service after a change indicates acceptance of
the updated policy.

---

## 11. Contact us

- Email: [support@det.app](mailto:support@det.app)
- In-app: Profile → Settings → Legal & about → Contact support

If you are in the EU/EEA, you can also contact our data protection
representative by emailing the address above with "DPO" in the
subject line.
