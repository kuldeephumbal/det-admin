# DET — Database Schema Reference

MongoDB, schema-validated by Mongoose. All user-owned collections use
soft delete (`deletedAt: Date | null`).

---

## `users`

| Field                   | Type        | Notes                                                 |
| ----------------------- | ----------- | ----------------------------------------------------- |
| `_id`                   | ObjectId    |                                                       |
| `name`                  | String      | required, 2–80 chars                                  |
| `email`                 | String      | required, unique, lowercase, indexed                  |
| `phone`                 | String      | optional, regex-validated                             |
| `password`              | String      | bcrypt hash, `select:false`                           |
| `avatarUrl`             | String      |                                                       |
| `role`                  | String      | `user` \| `admin`                                     |
| `status`                | String      | `active` \| `blocked` \| `deleted` (`select:false`)   |
| `plan`                  | String      | `free` \| `premium`                                   |
| `preferences.currency`  | String      | default `INR`                                         |
| `preferences.locale`    | String      | default `en-IN`                                       |
| `preferences.timezone`  | String      | default `Asia/Kolkata`                                |
| `preferences.themeMode` | String      | `system` \| `light` \| `dark`                         |
| `preferences.notifications.*` | Boolean | per-category toggles                                |
| `passwordResetToken`    | String      | hashed, `select:false`                                |
| `passwordResetExpires`  | Date        | `select:false`                                        |
| `passwordChangedAt`     | Date        | `select:false`                                        |
| `lastLoginAt`           | Date        |                                                       |
| `deletedAt`             | Date \| null| indexed                                               |
| `createdAt`/`updatedAt` | Date        | auto                                                  |

**Indexes:** `email` (unique), `role`, `status`, `deletedAt`
**Methods:** `comparePassword(candidate)`, `isPasswordChangedAfter(iatSec)`
**Hooks:** `pre('save')` — bcrypt hash on `password` change

---

## `categories`

| Field        | Type        | Notes                                                          |
| ------------ | ----------- | -------------------------------------------------------------- |
| `_id`        | ObjectId    |                                                                |
| `user`       | ObjectId    | null for system defaults; else owner                           |
| `name`       | String      | required, ≤ 40 chars                                           |
| `icon`       | String      | icon key (Flutter material icon name)                          |
| `color`      | String      | hex `#RRGGBB`                                                  |
| `isDefault`  | Boolean     | true for seeded system categories                              |
| `isActive`   | Boolean     | toggle visibility without delete                               |
| `sortOrder`  | Number      |                                                                |
| `deletedAt`  | Date \| null|                                                                |

**Indexes:**
- Unique partial: `(user, name, deletedAt)` where `user` is set
- Unique partial: `(name, isDefault)` where `isDefault=true && user=null`

**Statics:** `findForUser(userId)` — returns merged set of user + default

---

## `expenses`

| Field             | Type        | Notes                                       |
| ----------------- | ----------- | ------------------------------------------- |
| `_id`             | ObjectId    |                                             |
| `user`            | ObjectId    | required, indexed                           |
| `amount`          | Number      | required, ≥ 0, rounded to 2 decimals        |
| `currency`        | String      | enum, default `INR`                         |
| `category`        | ObjectId    | required → Category                         |
| `date`            | Date        | required, default now                       |
| `note`            | String      | ≤ 500 chars                                 |
| `paymentMethod`   | String      | cash/card/upi/netbanking/wallet/other       |
| `tags[]`          | String      | lowercase                                   |
| `attachmentUrl`   | String      |                                             |
| `recurringSource` | ObjectId    | RecurringExpense ref if auto-created        |
| `deletedAt`       | Date \| null|                                             |

**Indexes:** `(user, date desc)`, `(user, category, date desc)`, `(user, deletedAt, date desc)`
**Statics:** `sumForUser(userId, { from, to, category })` — aggregate total + count

---

## `budgets`

| Field             | Type        | Notes                                       |
| ----------------- | ----------- | ------------------------------------------- |
| `user`            | ObjectId    | required                                    |
| `category`        | ObjectId    | null = overall budget                       |
| `period`          | String      | `monthly` \| `yearly`                       |
| `month`           | Number      | YYYYMM, required if monthly                 |
| `year`            | Number      | required                                    |
| `amount`          | Number      | required, ≥ 0                               |
| `alertThreshold`  | Number      | percent 0–100, default 80                   |
| `alertSentAt`     | Date \| null| set once threshold notification fires       |
| `rolloverUnused`  | Boolean     |                                             |
| `isActive`        | Boolean     |                                             |

**Indexes:** Unique `(user, category, period, year, month, deletedAt)`

---

## `recurring_expenses`

| Field             | Type        | Notes                                       |
| ----------------- | ----------- | ------------------------------------------- |
| `user`            | ObjectId    | required                                    |
| `title`           | String      | required                                    |
| `amount`          | Number      | required                                    |
| `category`        | ObjectId    | required                                    |
| `paymentMethod`   | String      |                                             |
| `frequency`       | String      | daily/weekly/monthly/yearly                 |
| `interval`        | Number      | every N units, default 1                    |
| `dayOfMonth`      | Number      | 1–31 (monthly/yearly)                       |
| `weekday`         | Number      | 0=Sun, 6=Sat (weekly)                       |
| `startDate`       | Date        | required                                    |
| `endDate`         | Date \| null|                                             |
| `nextRunAt`       | Date        | indexed — cron picks rows with `<= now`     |
| `lastRunAt`       | Date \| null|                                             |
| `occurrenceCount` | Number      |                                             |
| `maxOccurrences`  | Number \| null|                                           |
| `isActive`        | Boolean     |                                             |

**Indexes:** `(user, isActive, nextRunAt)`

---

## `notifications`

| Field         | Type        | Notes                                           |
| ------------- | ----------- | ----------------------------------------------- |
| `user`        | ObjectId    | null = broadcast                                |
| `type`        | String      | budget_alert / monthly_summary / expense_reminder / recurring_reminder / announcement / system |
| `title`       | String      | required                                        |
| `body`        | String      |                                                 |
| `data`        | Mixed       | client payload                                  |
| `isRead`      | Boolean     |                                                 |
| `readAt`      | Date \| null|                                                 |
| `scheduledFor`| Date \| null|                                                 |
| `sentAt`      | Date \| null|                                                 |
| `expiresAt`   | Date \| null| TTL index                                       |

**Indexes:** `(user, isRead, createdAt desc)`, `scheduledFor`, TTL on `expiresAt`

---

## `subscriptions`

1:1 with user.

| Field                   | Type        | Notes                                |
| ----------------------- | ----------- | ------------------------------------ |
| `user`                  | ObjectId    | unique                               |
| `plan`                  | String      | free / premium                       |
| `status`                | String      | active / cancelled / expired / trialing |
| `billingCycle`          | String      | monthly / yearly / lifetime          |
| `price`                 | Number      |                                      |
| `currency`              | String      |                                      |
| `startedAt`             | Date        |                                      |
| `currentPeriodStart/End`| Date        |                                      |
| `cancelAt`/`cancelledAt`| Date        |                                      |
| `trialEndsAt`           | Date        |                                      |
| `provider*`             | String      | provider, customerId, subscriptionId |
| `features.*`            | Object      | feature gates (maxCategories, exportEnabled, ...) |

---

## Soft delete contract

- Every user-owned model has `deletedAt: Date | null`.
- Listing queries filter `{ deletedAt: null }`.
- Hard delete only via admin tool or scheduled cleanup (90 days post soft-delete).

## Cross-model invariants

- Deleting a `Category` that is referenced by undeleted `Expense`s requires `?force=true` and reassigns those expenses to the user's "Other" category.
- Materializing a `RecurringExpense` creates an `Expense` with `recurringSource = recurring._id`, atomically advances `nextRunAt` based on `frequency` + `interval`.
- Threshold alert: when a `Budget`'s used % crosses `alertThreshold`, create a `Notification(type='budget_alert')` and set `alertSentAt`. Reset `alertSentAt` at period rollover.
