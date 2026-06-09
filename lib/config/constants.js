module.exports = {
  ROLES: {
    USER: 'user',
    ADMIN: 'admin',
  },

  USER_STATUS: {
    ACTIVE: 'active',
    BLOCKED: 'blocked',
    DELETED: 'deleted',
  },

  PAYMENT_METHODS: ['cash', 'card', 'upi', 'netbanking', 'wallet', 'other'],

  RECURRING_FREQUENCIES: ['daily', 'weekly', 'monthly', 'yearly'],

  NOTIFICATION_TYPES: {
    BUDGET_ALERT: 'budget_alert',
    MONTHLY_SUMMARY: 'monthly_summary',
    EXPENSE_REMINDER: 'expense_reminder',
    RECURRING_REMINDER: 'recurring_reminder',
    ANNOUNCEMENT: 'announcement',
    SYSTEM: 'system',
    SUBSCRIPTION_RENEWAL: 'subscription_renewal',
    SUBSCRIPTION_PAYMENT_FAILED: 'subscription_payment_failed',
    SUBSCRIPTION_TRIAL_ENDING: 'subscription_trial_ending',
    SUBSCRIPTION_UPGRADED: 'subscription_upgraded',
    SUBSCRIPTION_CANCELLED: 'subscription_cancelled',
    BILL_DUE: 'bill_due',
    BILL_OVERDUE: 'bill_overdue',
    BILL_PAID: 'bill_paid',
    SPLIT_INVITE: 'split_invite',
    SPLIT_EXPENSE_ADDED: 'split_expense_added',
    SPLIT_SETTLEMENT: 'split_settlement',
  },

  BILL_RECURRENCES: ['none', 'weekly', 'monthly', 'quarterly', 'yearly'],

  // Days-ahead each bill fires a reminder push, in addition to the
  // day-of one. Mirrors Wallet's default (T-3 / T-1 / day-of).
  BILL_REMINDER_DAYS_AHEAD: [3, 1, 0],

  // Debts (Feature 15) — direction of the obligation.
  //   lent     = I gave money; they owe me (asset).
  //   borrowed = I received money; I owe them (liability).
  DEBT_TYPES: ['lent', 'borrowed'],
  DEBT_STATUSES: ['outstanding', 'settled'],

  // Shared accounts (Feature 16).
  //   owner  = the user who created the account; full control.
  //   member = invited user with read/write access. Cannot invite
  //            others or delete the account.
  // (No `viewer` tier in v1 — keeps the permission model simple.
  // Premium feature for the inviter; invitees don't need a paid plan
  // to accept.)
  ACCOUNT_ROLES: ['owner', 'member'],
  // Pending = invited but not yet accepted. Active = accepted, has
  // access. Declined = invitee said no (kept for history). Revoked =
  // previously active but later removed (owner kick OR self-leave).
  MEMBERSHIP_STATUSES: ['pending', 'active', 'declined', 'revoked'],

  // Split expenses (Splitwise-style groups). Roles + member lifecycle
  // mirror ACCOUNT_ROLES / MEMBERSHIP_STATUSES.
  GROUP_ROLES: ['owner', 'member'],
  GROUP_MEMBER_STATUSES: ['pending', 'active', 'declined', 'revoked'],
  // How a shared expense's total is divided among members.
  SPLIT_METHODS: ['equal', 'exact', 'percentage', 'shares'],

  SUBSCRIPTION_PLANS: {
    FREE: 'free',
    PREMIUM: 'premium',
  },

  SUBSCRIPTION_STATUS: {
    ACTIVE: 'active',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
    TRIALING: 'trialing',
    PAST_DUE: 'past_due',
  },

  BILLING_PROVIDERS: {
    STRIPE: 'stripe',
    GOOGLE: 'google',
    APPLE: 'apple',
    MANUAL: 'manual',
  },

  ACCOUNT_TYPES: {
    CASH: 'cash',
    BANK: 'bank',
    CREDIT_CARD: 'credit_card',
    WALLET: 'wallet',
    SAVINGS: 'savings',
    LOAN: 'loan',
  },

  SUBSCRIPTION_EVENT_TYPES: {
    CREATED: 'created',
    RENEWED: 'renewed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
    PAYMENT_FAILED: 'payment_failed',
    PLAN_CHANGED: 'plan_changed',
    GRACE_STARTED: 'grace_started',
    EXPIRED: 'expired',
    ADMIN_COMPED: 'admin_comped',
  },

  CURRENCIES: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'JPY', 'AUD', 'CAD'],

  DEFAULT_CATEGORIES: [
    { name: 'Food',          icon: 'restaurant',     color: '#FF7043' },
    { name: 'Travel',        icon: 'flight',         color: '#42A5F5' },
    { name: 'Shopping',      icon: 'shopping_bag',   color: '#AB47BC' },
    { name: 'Bills',         icon: 'receipt_long',   color: '#26A69A' },
    { name: 'Health',        icon: 'favorite',       color: '#EF5350' },
    { name: 'Education',     icon: 'school',         color: '#5C6BC0' },
    { name: 'Entertainment', icon: 'movie',          color: '#FFA726' },
    { name: 'Other',         icon: 'category',       color: '#78909C' },
  ],

  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },

  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE: 422,
    TOO_MANY: 429,
    INTERNAL: 500,
  },
};
