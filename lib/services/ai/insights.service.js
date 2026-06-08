// AI Insights service.
//
// Pipeline:
//   1. features.build() — pull aggregated MoM deltas, anomalies, goals.
//   2. detectors        — turn the feature pack into structured insight
//                         candidates (severity, type, inputs).
//   3. llm.narrate      — produce prose for each candidate, falling back
//                         to canned templates when ANTHROPIC_API_KEY is
//                         unset.
//   4. persist          — upsert one Insight per (user, type, period) so
//                         re-running the cron doesn't double-write.
//
// The cron runs Saturday 7am user-local-time; an on-demand
// /insights/regenerate endpoint is rate-capped per user (env-driven).

const mongoose = require('mongoose');
const User = require('../../models/User');
const { Insight } = require('../../models/Insight');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const env = require('../../config/env');
const { parsePagination } = require('../../utils/pagination');
const { NOTIFICATION_TYPES } = require('../../config/constants');
const features = require('./features');
const llm = require('./llm');
const notifications = require('../notification.service');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const toPublic = (i) => ({
  id: String(i._id),
  type: i.type,
  severity: i.severity,
  title: i.title,
  body: i.body,
  data: i.data || {},
  cta: i.cta?.label ? { label: i.cta.label, deepLink: i.cta.deepLink } : null,
  isRead: !!i.isRead,
  readAt: i.readAt || null,
  generatedAt: i.generatedAt,
  period: i.period,
});

// ---------- Detectors ----------
//
// Each detector returns an array of insight *candidates*:
//   { type, severity, title, inputs, data, cta? }
// `inputs` is what gets handed to the LLM/canned narrator to build
// the body text from.

const _detectAnomalies = (pack, currency) =>
  (pack.anomalies || []).map((a) => ({
    type: 'anomaly',
    severity: a.zScore >= 4 ? 'high' : 'medium',
    title: `Unusual ${a.amount.toFixed(0)} ${currency} expense`,
    inputs: {
      amount: a.amount,
      currency,
      category: a.category?.name || null,
      zScore: Math.round(a.zScore * 10) / 10,
    },
    data: {
      amount: a.amount,
      categoryId: a.categoryId,
      date: a.date,
    },
  }));

const _detectCategorySpikes = (pack, currency) =>
  (pack.deltas || [])
    .filter((d) => d.previous > 0 && d.pct !== null && d.pct >= 50 && d.current >= 500)
    .slice(0, 3)
    .map((d) => ({
      type: 'category_spike',
      severity: d.pct >= 100 ? 'high' : 'medium',
      title: `${d.category?.name || 'A category'} jumped ${Math.round(d.pct)}%`,
      inputs: {
        category: d.category?.name || 'this category',
        deltaPct: d.pct,
        current: d.current,
        previous: d.previous,
        currency,
      },
      data: {
        categoryId: d.categoryId,
        current: d.current,
        previous: d.previous,
        deltaPct: d.pct,
      },
      cta: d.categoryId
        ? { label: 'Set a budget', deepLink: `/budgets/new?category=${d.categoryId}` }
        : null,
    }));

const _detectGoalNudges = (pack) =>
  (pack.goals || [])
    .filter((g) => {
      // Behind = less than expected progress for elapsed deadline.
      const now = Date.now();
      const created = new Date(g.deadline).getTime() - 90 * 86400_000; // rough anchor
      const elapsedFraction =
        Math.min(1, Math.max(0, (now - created) / (new Date(g.deadline).getTime() - created)));
      const expected = elapsedFraction * 100;
      return g.progressPct < expected - 10;
    })
    .slice(0, 2)
    .map((g) => ({
      type: 'goal_nudge',
      severity: 'low',
      title: `Behind on ${g.name}`,
      inputs: { goalName: g.name, percent: g.progressPct },
      data: { goalId: g.id, percent: g.progressPct },
      cta: { label: 'Add a contribution', deepLink: `/savings/${g.id}` },
    }));

const _detectAll = (pack, currency) => [
  ..._detectAnomalies(pack, currency),
  ..._detectCategorySpikes(pack, currency),
  ..._detectGoalNudges(pack),
];

// ---------- Generation ----------

const _periodForGeneration = ({ now = new Date() } = {}) => {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(now);
  return { from, to };
};

// Generate (or refresh) insights for a single user. Returns the
// freshly persisted set. Idempotent for a given (user, type, period).
const generateForUser = async (userId, { now = new Date(), useLlm = true } = {}) => {
  const user = await User.findById(userId).select('preferences plan').lean();
  if (!user) throw ApiError.notFound('User not found');
  const currency = user.preferences?.currency || 'INR';

  const pack = await features.build(userId, { now });
  const candidates = _detectAll(pack, currency);
  if (candidates.length === 0) {
    return { items: [], generated: 0, skipped: 0 };
  }

  const { from, to } = _periodForGeneration({ now });

  const items = [];
  let totalCost = 0;
  for (const c of candidates) {
    const narrated = useLlm
      ? await llm.narrate({ type: c.type, inputs: c.inputs })
      : { text: '', model: 'canned', costTokens: 0 };
    totalCost += narrated.costTokens || 0;

    // Upsert keyed by (user, type, period.from). Re-running the cron
    // updates the same row rather than appending duplicates.
    const updated = await Insight.findOneAndUpdate(
      { user: oid(userId), type: c.type, 'period.from': from },
      {
        $set: {
          user: oid(userId),
          type: c.type,
          severity: c.severity,
          title: c.title,
          body: narrated.text,
          data: c.data || {},
          cta: c.cta || { label: '', deepLink: '' },
          period: { from, to },
          generatedAt: new Date(),
          model: narrated.model,
          costTokens: narrated.costTokens || 0,
        },
        $setOnInsert: { isRead: false },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    items.push(toPublic(updated));
  }

  return { items, generated: items.length, totalCost };
};

// ---------- Public API ----------

const list = async (userId, q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const filter = { user: oid(userId) };
  if (q.unreadOnly === 'true' || q.unreadOnly === true) filter.isRead = false;
  if (q.type) filter.type = q.type;

  const [items, total] = await Promise.all([
    Insight.find(filter).sort({ generatedAt: -1 }).skip(skip).limit(limit).lean(),
    Insight.countDocuments(filter),
  ]);
  return { items: items.map(toPublic), page, limit, total };
};

const markRead = async (userId, id) => {
  const doc = await Insight.findOneAndUpdate(
    { _id: id, user: oid(userId), isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );
  // Idempotent — already-read returns the existing row.
  if (!doc) {
    const existing = await Insight.findOne({ _id: id, user: oid(userId) }).lean();
    if (!existing) throw ApiError.notFound('Insight not found');
    return toPublic(existing);
  }
  return toPublic(doc);
};

// Per-user daily regenerate cap. Returns the count of insights produced
// today (cron + on-demand), used to enforce env.INSIGHT_REGENERATE_DAILY_CAP.
const _todaysCount = async (userId) => {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  return Insight.countDocuments({ user: oid(userId), generatedAt: { $gte: since } });
};

const regenerate = async (userId) => {
  const used = await _todaysCount(userId);
  if (used >= env.INSIGHT_REGENERATE_DAILY_CAP) {
    throw new ApiError(429, `Daily regenerate cap (${env.INSIGHT_REGENERATE_DAILY_CAP}) reached`, {
      code: 'INSIGHT_CAP_REACHED',
    });
  }
  const result = await generateForUser(userId);

  // Best-effort high-severity push.
  const high = result.items.find((i) => i.severity === 'high');
  if (high) {
    notifications
      .dispatch({
        user: userId,
        type: NOTIFICATION_TYPES.SYSTEM,
        title: high.title,
        body: high.body,
        data: { insightId: high.id },
        deepLink: `/insights/${high.id}`,
      })
      .catch(() => {});
  }

  return result;
};

// ---------- Weekly cron ----------
//
// Saturday 7am-user-local-time isn't directly schedulable in a single
// cron line — we run hourly and only process users whose current local
// hour is 7am AND whose local day-of-week is Saturday. Sharding by
// user-id mod N keeps each invocation bounded.

const _isSaturday7amInTz = (now, tz) => {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value, 10);
    return weekday === 'Sat' && hour === 7;
  } catch (_) {
    return false;
  }
};

const runWeeklyDigest = async ({ now = new Date() } = {}) => {
  // Only premium users get insights — the cron over-selects then filters
  // in-memory to keep the query indexable.
  const premiumUsers = await User.find({ plan: 'premium', deletedAt: null })
    .select('_id preferences.timezone')
    .lean();

  let processed = 0;
  let skipped = 0;
  for (const u of premiumUsers) {
    const tz = u.preferences?.timezone || 'UTC';
    if (!_isSaturday7amInTz(now, tz)) {
      skipped += 1;
      continue;
    }
    try {
      await generateForUser(String(u._id), { now });
      processed += 1;
    } catch (err) {
      logger.warn('insights weekly digest row failed', {
        userId: String(u._id),
        message: err.message,
      });
    }
  }
  return { processed, skipped, at: now };
};

module.exports = {
  list,
  markRead,
  regenerate,
  generateForUser,
  runWeeklyDigest,
};
