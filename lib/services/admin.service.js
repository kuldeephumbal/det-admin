const User = require('../models/User');
const Category = require('../models/Category');
const Subscription = require('../models/Subscription');
const ApiError = require('../utils/ApiError');
const { USER_STATUS, NOTIFICATION_TYPES } = require('../config/constants');
const { parsePagination } = require('../utils/pagination');
const notifications = require('./notification.service');

// --- Dashboard ---------------------------------------------------------

const TREND_DAYS = 7;

// Pad a sparse aggregation result so the chart always renders one bar per day
// in the window — including days that had zero signups.
const padDailySeries = (rows, days) => {
  const map = new Map(rows.map((r) => [r._id, r.count]));
  const now = new Date();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
    out.push({ date: key, count: map.get(key) || 0 });
  }
  return out;
};

const dashboard = async () => {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfWeek = new Date(startOfDay); startOfWeek.setUTCDate(startOfWeek.getUTCDate() - 6);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last30 = new Date(now.getTime() - 30 * 86400_000);

  // Trend window — starts at midnight UTC of (today - TREND_DAYS + 1) so we
  // count today's signups too.
  const trendStart = new Date(startOfDay);
  trendStart.setUTCDate(trendStart.getUTCDate() - (TREND_DAYS - 1));

  // Intentionally NO expense aggregation here. The admin dashboard must not
  // surface user spending — even in aggregate — so the admin Expense model
  // isn't queried from this path at all.
  const [totalUsers, activeUsers, newToday, newThisWeek, newThisMonth, planAgg, subStatusAgg, recent] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ deletedAt: null, lastLoginAt: { $gte: last30 } }),
    User.countDocuments({ createdAt: { $gte: startOfDay } }),
    User.countDocuments({ createdAt: { $gte: startOfWeek } }),
    User.countDocuments({ createdAt: { $gte: startOfMonth } }),
    User.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]),
    Subscription.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    User.find({ deletedAt: null }).sort({ createdAt: -1 }).limit(8).select('name email plan role status createdAt').lean(),
  ]);

  // Last-7-day registration trend, padded so every day shows up.
  const rawTrend = await User.aggregate([
    { $match: { createdAt: { $gte: trendStart } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const registrationTrend = padDailySeries(rawTrend, TREND_DAYS);

  const planCounts = { free: 0, premium: 0 };
  for (const p of planAgg) {
    if (p._id) planCounts[p._id] = p.count;
  }
  const subscriptionCounts = { active: 0, cancelled: 0, expired: 0, trialing: 0 };
  for (const s of subStatusAgg) {
    if (s._id) subscriptionCounts[s._id] = s.count;
  }

  return {
    totals: {
      users: totalUsers,
      activeUsers,
      newToday,
      newThisWeek,
      newThisMonth,
    },
    plans: planCounts,
    subscriptions: subscriptionCounts,
    trendWindowDays: TREND_DAYS,
    registrationTrend,
    recentUsers: recent.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      plan: u.plan,
      role: u.role,
      status: u.status || 'active',
      createdAt: u.createdAt,
    })),
  };
};

// --- Users -------------------------------------------------------------

const listUsers = async (q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const filter = { deletedAt: null };
  if (q.role) filter.role = q.role;
  if (q.plan) filter.plan = q.plan;
  if (q.status) filter.status = q.status;
  if (q.q) {
    const safe = q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
    ];
  }

  // status has `select: false`, so explicitly include it for the admin view.
  const [items, total] = await Promise.all([
    User.find(filter).select('+status').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);

  return {
    items: items.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      phone: u.phone || null,
      role: u.role,
      plan: u.plan,
      status: u.status || 'active',
      avatarUrl: u.avatarUrl || null,
      lastLoginAt: u.lastLoginAt || null,
      createdAt: u.createdAt,
    })),
    page,
    limit,
    total,
  };
};

const getUser = async (id) => {
  const u = await User.findOne({ _id: id, deletedAt: null }).select('+status').lean();
  if (!u) throw ApiError.notFound('User not found');

  // No expense aggregates here either — admins manage accounts and statuses,
  // they don't get to see what individual users spent or on what.
  const sub = await Subscription.findOne({ user: id }).lean();

  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    phone: u.phone || null,
    role: u.role,
    plan: u.plan,
    status: u.status || 'active',
    preferences: u.preferences,
    lastLoginAt: u.lastLoginAt || null,
    createdAt: u.createdAt,
    subscription: sub ? { plan: sub.plan, status: sub.status, billingCycle: sub.billingCycle, currentPeriodEnd: sub.currentPeriodEnd } : null,
  };
};

const updateUserStatus = async (id, status, actorId) => {
  if (String(id) === String(actorId)) {
    throw ApiError.badRequest("You can't change your own status from here");
  }
  const u = await User.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: { status } },
    { new: true }
  ).select('+status');
  if (!u) throw ApiError.notFound('User not found');
  return { id: String(u._id), status: u.status };
};

// --- Default categories -----------------------------------------------

const listDefaultCategories = async () => {
  const docs = await Category.find({ isDefault: true, user: null, deletedAt: null })
    .sort({ sortOrder: 1, name: 1 })
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    icon: d.icon,
    color: d.color,
    sortOrder: d.sortOrder || 0,
    isActive: d.isActive !== false,
  }));
};

const createDefaultCategory = async (payload) => {
  const doc = await Category.create({
    ...payload,
    user: null,
    isDefault: true,
  });
  return {
    id: String(doc._id),
    name: doc.name,
    icon: doc.icon,
    color: doc.color,
    sortOrder: doc.sortOrder,
    isActive: doc.isActive,
  };
};

const updateDefaultCategory = async (id, patch) => {
  const doc = await Category.findOneAndUpdate(
    { _id: id, isDefault: true, user: null, deletedAt: null },
    { $set: patch },
    { new: true, runValidators: true, context: 'query' }
  );
  if (!doc) throw ApiError.notFound('Default category not found');
  return {
    id: String(doc._id),
    name: doc.name,
    icon: doc.icon,
    color: doc.color,
    sortOrder: doc.sortOrder,
    isActive: doc.isActive,
  };
};

const deleteDefaultCategory = async (id) => {
  const doc = await Category.findOneAndUpdate(
    { _id: id, isDefault: true, user: null, deletedAt: null },
    { $set: { deletedAt: new Date(), isActive: false } }
  );
  if (!doc) throw ApiError.notFound('Default category not found');
};

// --- Broadcast --------------------------------------------------------

const broadcast = async ({ title, body, type, expiresInDays }) => {
  // Broadcasts fan out via FCM too — notification.service._fanOut
  // handles `user: null` by querying every active device with a token
  // and dispatching in 500-token batches. Title + body are the only
  // fields surfaced by the admin form; per-user reminders are
  // generated automatically by other services (budget, bills, etc.).
  const doc = await notifications.dispatch({
    user: null,
    type: type || NOTIFICATION_TYPES.ANNOUNCEMENT,
    title,
    body: body || '',
    expiresAt: expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400_000)
      : null,
  });
  return { id: doc.id, createdAt: doc.createdAt };
};

// Per-user notifications are NOT exposed via admin panel — those fire
// automatically from the server when events happen (bill due, budget
// breached, shared-account invite accepted, etc.). The admin only
// drives the broadcast above.

// --- Subscriptions ----------------------------------------------------

const listSubscriptions = async (q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const filter = {};
  if (q.plan) filter.plan = q.plan;
  if (q.status) filter.status = q.status;

  const [items, total] = await Promise.all([
    Subscription.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'user', select: 'name email' })
      .lean(),
    Subscription.countDocuments(filter),
  ]);

  return {
    items: items.map((s) => ({
      id: String(s._id),
      plan: s.plan,
      status: s.status,
      billingCycle: s.billingCycle,
      price: s.price || 0,
      currency: s.currency,
      startedAt: s.startedAt,
      currentPeriodEnd: s.currentPeriodEnd,
      user: s.user
        ? { id: String(s.user._id), name: s.user.name, email: s.user.email }
        : null,
    })),
    page,
    limit,
    total,
  };
};

// --- Phase 2–4 overviews ----------------------------------------------
//
// Read-only operational support views. All of these obey the admin
// privacy rule below.
//
// ╔════════════════════════════════════════════════════════════════════╗
// ║ ADMIN PRIVACY RULE                                                 ║
// ║                                                                    ║
// ║ Admins manage USER LIFECYCLE (registrations, plans, statuses) and  ║
// ║ OPERATIONAL HEALTH (queue depths, error rates, model costs).       ║
// ║                                                                    ║
// ║ Admins MUST NOT see individual user financial / personal data —    ║
// ║ this is the line we promise users in the Play Store privacy        ║
// ║ policy. Specifically: never surface any of the following from an   ║
// ║ admin-facing read:                                                 ║
// ║                                                                    ║
// ║   • Individual account balances or names                           ║
// ║   • Individual goal names / amounts / contributions                ║
// ║   • Individual expense rows (amounts, merchants, notes)            ║
// ║   • OCR'd receipt content (merchant, total, line items)            ║
// ║   • LLM-narrated insight bodies (personal analysis of a user's     ║
// ║     finances)                                                      ║
// ║   • Bill names (often personal — "Rent to Mike", "Therapist")      ║
// ║   • Bank account masks / institution names tied to a user          ║
// ║                                                                    ║
// ║ Aggregates ARE fine — counts by status, distributions across       ║
// ║ users, total-pool sums, etc. — provided they can't be reduced to   ║
// ║ a single user (k-anonymity at minimum). Operational fields like    ║
// ║ "job is failing" or "this user hasn't verified email" stay         ║
// ║ surfaced because they're how admins do their job.                  ║
// ║                                                                    ║
// ║ When in doubt, drop the column. The user's data is the user's.     ║
// ╚════════════════════════════════════════════════════════════════════╝

const { SavingsGoal } = require('../models/SavingsGoal');
const { ReceiptScan } = require('../models/ReceiptScan');
const { Insight } = require('../models/Insight');
const SmsParserRule = require('../models/SmsParserRule');
const { BankConnection } = require('../models/BankConnection');
const FinancialScoreSnapshot = require('../models/FinancialScoreSnapshot');
const Account = require('../models/Account');

// Privacy: no per-user goal names / amounts / contributions. Admins
// see status distribution and aggregate completion stats only.
const listSavingsGoalsOverview = async () => {
  const [statusAgg, completionAgg] = await Promise.all([
    SavingsGoal.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    // Average completion percentage across active goals — pool-wide,
    // not per-user. Excludes goals with no target to avoid div-by-zero.
    SavingsGoal.aggregate([
      { $match: { deletedAt: null, status: 'active', targetAmount: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          n: { $sum: 1 },
          avgProgress: {
            $avg: { $divide: ['$currentAmount', '$targetAmount'] },
          },
        },
      },
    ]),
  ]);

  const counts = { active: 0, completed: 0, abandoned: 0 };
  for (const s of statusAgg) {
    if (s._id) counts[s._id] = s.count;
  }

  return {
    counts,
    activeUsers: completionAgg[0]?.n || 0,
    avgProgressPct: completionAgg[0]?.avgProgress
      ? Math.round(completionAgg[0].avgProgress * 100)
      : 0,
  };
};

// Privacy: receipt images and extracted (merchant / total / line items)
// are user financial PII. Admins see queue depth + recent error
// signatures for support, never per-user content.
const listOcrJobs = async () => {
  const [statusAgg, recentFailures, latencyAgg] = await Promise.all([
    ReceiptScan.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    // Failure SIGNATURES (the error message), aggregated — useful for
    // diagnosing "Vision API is returning 503" or "key rotated" without
    // exposing which user uploaded what.
    ReceiptScan.aggregate([
      {
        $match: {
          status: 'failed',
          deletedAt: null,
          error: { $ne: '' },
          updatedAt: { $gte: new Date(Date.now() - 7 * 86400_000) },
        },
      },
      { $group: { _id: '$error', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, signature: '$_id', count: 1 } },
    ]),
    // Average processing latency (completed only).
    ReceiptScan.aggregate([
      {
        $match: {
          status: 'completed',
          completedAt: { $ne: null },
          updatedAt: { $gte: new Date(Date.now() - 7 * 86400_000) },
        },
      },
      {
        $project: {
          latencyMs: { $subtract: ['$completedAt', '$createdAt'] },
        },
      },
      { $group: { _id: null, avg: { $avg: '$latencyMs' }, n: { $sum: 1 } } },
    ]),
  ]);

  const counts = { pending: 0, processing: 0, completed: 0, failed: 0 };
  for (const s of statusAgg) {
    if (s._id) counts[s._id] = s.count;
  }

  return {
    counts,
    recentFailures,
    avgLatencyMs: Math.round(latencyAgg[0]?.avg || 0),
    sampledCompletions: latencyAgg[0]?.n || 0,
  };
};

// Privacy: insight titles + bodies are personalised analysis of a
// user's finances. Admins see cost / volume aggregates and severity
// distribution — never the per-user prose.
const insightsOverview = async () => {
  const since = new Date(Date.now() - 30 * 86400_000);

  const [dailyAgg, totals, severityAgg] = await Promise.all([
    Insight.aggregate([
      { $match: { generatedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$generatedAt' } },
          count: { $sum: 1 },
          tokens: { $sum: { $ifNull: ['$costTokens', 0] } },
          cannedCount: {
            $sum: { $cond: [{ $eq: ['$model', 'canned'] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Insight.aggregate([
      {
        $group: {
          _id: null,
          totalInsights: { $sum: 1 },
          totalTokens: { $sum: { $ifNull: ['$costTokens', 0] } },
          cannedCount: { $sum: { $cond: [{ $eq: ['$model', 'canned'] }, 1, 0] } },
        },
      },
    ]),
    // Distribution by severity — operationally useful to spot a
    // mis-tuned detector firing too many `high`s.
    Insight.aggregate([
      { $match: { generatedAt: { $gte: since } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
  ]);

  const severity = { info: 0, low: 0, medium: 0, high: 0 };
  for (const s of severityAgg) {
    if (s._id) severity[s._id] = s.count;
  }

  return {
    daily: dailyAgg.map((d) => ({
      date: d._id,
      count: d.count,
      tokens: d.tokens,
      cannedCount: d.cannedCount,
    })),
    totals: totals[0] || { totalInsights: 0, totalTokens: 0, cannedCount: 0 },
    severity,
  };
};

const listSmsRules = async (q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const filter = {};
  if (q.activeOnly === 'true' || q.activeOnly === true) filter.isActive = true;
  if (q.bankName) filter.bankName = q.bankName;

  const [items, total] = await Promise.all([
    SmsParserRule.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    SmsParserRule.countDocuments(filter),
  ]);

  return {
    items: items.map((r) => ({
      id: String(r._id),
      name: r.name,
      bankName: r.bankName || '',
      senderPattern: r.senderPattern,
      amountRegex: r.amountRegex,
      merchantRegex: r.merchantRegex || '',
      currency: r.currency,
      version: r.version,
      isActive: r.isActive !== false,
      updatedAt: r.updatedAt,
    })),
    page,
    limit,
    total,
  };
};

// Privacy: per-user bank/account masks are user financial PII. Admins
// see aggregate provider + status distribution and a count of stale
// or error-state connections — never which user is connected where.
const bankConnectionsOverview = async () => {
  const [providerAgg, statusAgg, staleAgg] = await Promise.all([
    BankConnection.aggregate([{ $group: { _id: '$provider', count: { $sum: 1 } } }]),
    BankConnection.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    // Connections with errors or stale (>2 days since last sync) —
    // operationally useful to spot a provider outage.
    BankConnection.aggregate([
      {
        $match: {
          status: 'active',
          $or: [
            { lastError: { $nin: ['', null] } },
            { lastSyncedAt: { $lte: new Date(Date.now() - 2 * 86400_000) } },
          ],
        },
      },
      { $count: 'count' },
    ]),
  ]);

  const byProvider = {};
  for (const p of providerAgg) byProvider[p._id || 'unknown'] = p.count;
  const byStatus = { active: 0, requires_reauth: 0, disconnected: 0, error: 0 };
  for (const s of statusAgg) {
    if (s._id) byStatus[s._id] = s.count;
  }

  return {
    byProvider,
    byStatus,
    needsAttention: staleAgg[0]?.count || 0,
  };
};

const financialScoresOverview = async () => {
  // Score distribution histogram for the most-recent period present.
  const latestPeriod = await FinancialScoreSnapshot.aggregate([
    { $group: { _id: { year: '$period.year', month: '$period.month' } } },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    { $limit: 1 },
  ]);

  if (latestPeriod.length === 0) {
    return { period: null, histogram: [], totalScored: 0, mean: 0 };
  }

  const period = latestPeriod[0]._id;
  const rows = await FinancialScoreSnapshot.find({
    'period.year': period.year,
    'period.month': period.month,
  }).select('score').lean();

  // 10-bucket histogram (0-9, 10-19, ..., 90-100).
  const histogram = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${i === 9 ? 100 : i * 10 + 9}`,
    count: 0,
  }));
  let sum = 0;
  for (const r of rows) {
    const bucket = Math.min(9, Math.floor(r.score / 10));
    histogram[bucket].count += 1;
    sum += r.score;
  }

  return {
    period,
    histogram,
    totalScored: rows.length,
    mean: rows.length ? Math.round(sum / rows.length) : 0,
  };
};

// --- Settings test actions --------------------------------------------

// Privacy: per-user account names, masks, and balances are core
// financial PII. Admins see type distribution + average accounts per
// user — never which user has what.
const accountsOverview = async () => {
  const [typeAgg, perUserAgg, archivedCount] = await Promise.all([
    // Count by type only. We do NOT surface balance sums here either —
    // even a pool-wide sum can be sensitive if a deployment has few
    // users (e.g. a single-tenant or family install).
    Account.aggregate([
      { $match: { deletedAt: null, isArchived: false } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    // Average accounts per user — operationally useful for spotting
    // outliers (a user with 100 accounts is likely a test fixture).
    Account.aggregate([
      { $match: { deletedAt: null, isArchived: false } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $group: { _id: null, totalUsers: { $sum: 1 }, totalAccounts: { $sum: '$count' } } },
    ]),
    Account.countDocuments({ isArchived: true, deletedAt: null }),
  ]);

  const byType = {};
  for (const t of typeAgg) {
    if (t._id) byType[t._id] = t.count;
  }

  const usersWithAccounts = perUserAgg[0]?.totalUsers || 0;
  const totalAccounts = perUserAgg[0]?.totalAccounts || 0;

  return {
    byType,
    usersWithAccounts,
    totalAccounts,
    avgPerUser: usersWithAccounts > 0
      ? Math.round((totalAccounts / usersWithAccounts) * 10) / 10
      : 0,
    archivedCount,
  };
};

// Shared-accounts admin overview (Feature 16). Honors the same
// ADMIN PRIVACY RULE as everywhere else in this file:
//   - Counts grouped by membership status — no user names or emails.
//   - "Top sharing accounts" returns counts only, not account names or
//     balances. Useful for spotting families with >5 members on a
//     single account, which is a heuristic for promotional outreach.
//   - "Pending older than 14d" surfaces stale invites without naming
//     anyone — operational signal only.
const AccountMembership = require('../models/AccountMembership');
const sharedAccountsOverview = async () => {
  const FOURTEEN_DAYS_AGO = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [statusAgg, roleAgg, accountsWithMembers, stalePendingCount] = await Promise.all([
    AccountMembership.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AccountMembership.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    // Count distinct accounts that have at least one active member.
    AccountMembership.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$account' } },
      { $count: 'count' },
    ]),
    AccountMembership.countDocuments({
      status: 'pending',
      invitedAt: { $lt: FOURTEEN_DAYS_AGO },
    }),
  ]);
  const byStatus = { pending: 0, active: 0, declined: 0, revoked: 0 };
  for (const s of statusAgg) {
    if (s._id) byStatus[s._id] = s.count;
  }
  const byRole = { owner: 0, member: 0 };
  for (const r of roleAgg) {
    if (r._id) byRole[r._id] = r.count;
  }
  const sharedAccounts = accountsWithMembers[0]?.count || 0;
  // Active members per shared account — averaged across shared
  // accounts only (i.e. excludes accounts with zero members).
  const avgMembersPerSharedAccount = sharedAccounts > 0
    ? Math.round((byStatus.active / sharedAccounts) * 10) / 10
    : 0;
  return {
    byStatus,
    byRole,
    sharedAccounts,
    avgMembersPerSharedAccount,
    stalePendingCount,
  };
};

// Privacy: counterparty names ("Mike", "Mom"), amounts, and per-user
// settlement history are sensitive. Admins get type + status
// distribution only — never the per-user roster.
const Debt = require('../models/Debt');
const debtsOverview = async () => {
  const [typeAgg, statusAgg, perUserAgg] = await Promise.all([
    Debt.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    Debt.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Debt.aggregate([
      { $match: { deletedAt: null, status: 'outstanding' } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
      { $group: { _id: null, users: { $sum: 1 }, totalActive: { $sum: '$count' } } },
    ]),
  ]);
  const byType = { lent: 0, borrowed: 0 };
  for (const t of typeAgg) {
    if (t._id) byType[t._id] = t.count;
  }
  const byStatus = { outstanding: 0, settled: 0 };
  for (const s of statusAgg) {
    if (s._id) byStatus[s._id] = s.count;
  }
  const usersWithActive = perUserAgg[0]?.users || 0;
  const totalActive = perUserAgg[0]?.totalActive || 0;
  return {
    byType,
    byStatus,
    usersWithActive,
    avgActivePerUser: usersWithActive > 0
      ? Math.round((totalActive / usersWithActive) * 10) / 10
      : 0,
  };
};

// Privacy: bill names are often deeply personal ("Rent to Mike",
// "Therapist"). Admins get state + recurrence distribution and an
// overdue-watch counter — never the per-user roster.
const Bill = require('../models/Bill');
const billsOverview = async () => {
  const now = new Date();
  const [stateAgg, recurrenceAgg, overdueAgg, dueThisWeekAgg] = await Promise.all([
    // Group all bills by computed state.
    Bill.aggregate([
      { $match: { deletedAt: null } },
      {
        $project: {
          state: {
            $cond: [
              { $ne: ['$paidAt', null] },
              'paid',
              { $cond: [{ $lte: ['$dueDate', now] }, 'overdue', 'upcoming'] },
            ],
          },
        },
      },
      { $group: { _id: '$state', count: { $sum: 1 } } },
    ]),
    Bill.aggregate([
      { $match: { deletedAt: null, paidAt: null } },
      { $group: { _id: '$recurrence', count: { $sum: 1 } } },
    ]),
    Bill.aggregate([
      {
        $match: {
          deletedAt: null,
          paidAt: null,
          dueDate: { $lte: now },
        },
      },
      { $count: 'count' },
    ]),
    Bill.aggregate([
      {
        $match: {
          deletedAt: null,
          paidAt: null,
          dueDate: { $gt: now, $lte: new Date(now.getTime() + 7 * 86400_000) },
        },
      },
      { $count: 'count' },
    ]),
  ]);

  const counts = { upcoming: 0, overdue: 0, paid: 0 };
  for (const s of stateAgg) {
    if (s._id) counts[s._id] = s.count;
  }
  const byRecurrence = {};
  for (const r of recurrenceAgg) {
    if (r._id) byRecurrence[r._id] = r.count;
  }
  return {
    counts,
    byRecurrence,
    overdueNow: overdueAgg[0]?.count || 0,
    dueThisWeek: dueThisWeekAgg[0]?.count || 0,
  };
};

const mailer = require('../utils/mailer');

const sendTestEmail = async ({ to, actor }) => {
  const subject = 'DET — SMTP test message';
  const text = `Hi ${actor?.name || 'admin'},

This is a test message from the DET admin panel.

If you're seeing this in your inbox, your SMTP configuration is working end-to-end.

— DET admin (${actor?.email || 'unknown'})`;
  const html = `<p>Hi ${actor?.name || 'admin'},</p>
<p>This is a test message from the DET admin panel.</p>
<p>If you're seeing this in your inbox, your SMTP configuration is working end-to-end.</p>
<p>— DET admin (${actor?.email || 'unknown'})</p>`;
  try {
    return await mailer.sendMail({ to, subject, text, html });
  } catch (e) {
    // Translate the most common SMTP / DNS failures into a clean
    // 400-class error so the admin sees an actionable message instead
    // of a raw stack trace in the response.
    //
    // EBADNAME / ENOTFOUND on a DNS A query almost always means the
    // SMTP `host` field was filled with an email address or a URL
    // instead of a plain hostname like `smtp.gmail.com`.
    const code = e?.code || '';
    const cmd = e?.syscall || '';
    if (code === 'EBADNAME' || code === 'ENOTFOUND' || cmd === 'queryA') {
      throw ApiError.badRequest(
        `SMTP host can't be resolved (${code || cmd}). The "Host" field should be the SMTP server hostname (e.g. "smtp.gmail.com") — not an email address or URL.`,
        { code: 'SMTP_HOST_BAD' }
      );
    }
    if (code === 'EAUTH' || /auth/i.test(e?.message || '')) {
      throw ApiError.badRequest(
        'SMTP authentication failed. Check the username and password / app-password.',
        { code: 'SMTP_AUTH_FAILED' }
      );
    }
    if (code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') {
      throw ApiError.badRequest(
        `Could not connect to the SMTP server (${code}). Check host, port, and whether the firewall allows outbound to that port.`,
        { code: 'SMTP_CONNECT_FAILED' }
      );
    }
    // Unknown error — re-throw so the global handler logs the stack and
    // returns a generic 500.
    throw e;
  }
};

module.exports = {
  dashboard,
  listUsers,
  getUser,
  updateUserStatus,
  listDefaultCategories,
  createDefaultCategory,
  updateDefaultCategory,
  deleteDefaultCategory,
  broadcast,
  listSubscriptions,
  listSavingsGoalsOverview,
  listOcrJobs,
  insightsOverview,
  listSmsRules,
  bankConnectionsOverview,
  financialScoresOverview,
  accountsOverview,
  billsOverview,
  debtsOverview,
  sharedAccountsOverview,
  sendTestEmail,
};
