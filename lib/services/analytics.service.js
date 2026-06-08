// All analytics aggregations live here. Pipelines are intentionally
// chunky — they shave dozens of round-trips off the dashboard load.

const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const User = require('../models/User');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const resolveTimezone = async (userId, override) => {
  if (override) return override;
  const u = await User.findById(userId).select('preferences.timezone preferences.currency').lean();
  return u?.preferences?.timezone || 'UTC';
};

const resolveCurrency = async (userId) => {
  const u = await User.findById(userId).select('preferences.currency').lean();
  return u?.preferences?.currency || 'INR';
};

const formatCategory = (c) =>
  c
    ? { id: String(c._id), name: c.name, icon: c.icon, color: c.color }
    : null;

// --- Dashboard ----------------------------------------------------------

const dashboard = async (userId, { timezone } = {}) => {
  const tz = await resolveTimezone(userId, timezone);
  const currency = await resolveCurrency(userId);
  const userObj = oid(userId);

  const sumOnly = [
    { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $project: { _id: 0, amount: 1, count: 1 } },
  ];

  const trunc = (unit) => ({
    $dateTrunc: { date: '$$NOW', unit, timezone: tz, ...(unit === 'week' && { startOfWeek: 'monday' }) },
  });

  const matchSinceBucket = (unit) => ({
    $match: { $expr: { $gte: ['$date', trunc(unit)] } },
  });

  const [out] = await Expense.aggregate([
    { $match: { user: userObj, deletedAt: null } },
    {
      $facet: {
        today: [matchSinceBucket('day'), ...sumOnly],
        week:  [matchSinceBucket('week'), ...sumOnly],
        month: [matchSinceBucket('month'), ...sumOnly],
        year:  [matchSinceBucket('year'), ...sumOnly],

        recent: [
          { $sort: { date: -1, _id: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'categories',
              localField: 'category',
              foreignField: '_id',
              as: 'category',
            },
          },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              amount: 1,
              currency: 1,
              date: 1,
              note: { $ifNull: ['$note', ''] },
              paymentMethod: 1,
              tags: { $ifNull: ['$tags', []] },
              category: {
                $cond: [
                  { $ifNull: ['$category._id', false] },
                  {
                    id: { $toString: '$category._id' },
                    name: '$category.name',
                    icon: '$category.icon',
                    color: '$category.color',
                  },
                  null,
                ],
              },
              createdAt: 1,
            },
          },
        ],

        topCategoriesThisMonth: [
          matchSinceBucket('month'),
          {
            $group: {
              _id: '$category',
              amount: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { amount: -1 } },
          { $limit: 5 },
          {
            $lookup: {
              from: 'categories',
              localField: '_id',
              foreignField: '_id',
              as: 'category',
            },
          },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              amount: 1,
              count: 1,
              category: {
                $cond: [
                  { $ifNull: ['$category._id', false] },
                  {
                    id: { $toString: '$category._id' },
                    name: '$category.name',
                    icon: '$category.icon',
                    color: '$category.color',
                  },
                  null,
                ],
              },
            },
          },
        ],
      },
    },
  ]);

  const emptySum = { amount: 0, count: 0 };
  const totals = {
    today: out.today[0] || emptySum,
    week:  out.week[0]  || emptySum,
    month: out.month[0] || emptySum,
    year:  out.year[0]  || emptySum,
  };

  return {
    currency,
    timezone: tz,
    totals,
    recentExpenses: out.recent,
    topCategories: out.topCategoriesThisMonth,
  };
};

// --- Time series helpers -----------------------------------------------

const seriesPipeline = ({ userObj, since, unit, tz, format, sortKey }) => [
  { $match: { user: userObj, deletedAt: null, date: { $gte: since } } },
  {
    $group: {
      _id: {
        $dateTrunc: {
          date: '$date',
          unit,
          timezone: tz,
          ...(unit === 'week' && { startOfWeek: 'monday' }),
        },
      },
      amount: { $sum: '$amount' },
      count: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
  {
    $project: {
      _id: 0,
      bucketDate: '$_id',
      label: { $dateToString: { date: '$_id', format, timezone: tz } },
      amount: 1,
      count: 1,
    },
  },
];

const buildSeries = async (userId, { unit, count, format, override, sortKey = 'date' }) => {
  const tz = await resolveTimezone(userId, override);
  const currency = await resolveCurrency(userId);
  const since = computeSince(unit, count);

  const items = await Expense.aggregate(
    seriesPipeline({ userObj: oid(userId), since, unit, tz, format, sortKey })
  );

  const total = items.reduce((s, x) => s + x.amount, 0);
  const txns = items.reduce((s, x) => s + x.count, 0);

  return {
    timezone: tz,
    currency,
    range: { from: since, to: new Date() },
    bucket: unit,
    items,
    total,
    count: txns,
    average: items.length ? total / items.length : 0,
  };
};

const computeSince = (unit, count) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  switch (unit) {
    case 'day':   d.setUTCDate(d.getUTCDate() - (count - 1)); break;
    case 'week':  d.setUTCDate(d.getUTCDate() - (count * 7 - 1)); break;
    case 'month': d.setUTCMonth(d.getUTCMonth() - (count - 1)); d.setUTCDate(1); break;
    case 'year':  d.setUTCFullYear(d.getUTCFullYear() - (count - 1)); d.setUTCMonth(0, 1); break;
  }
  return d;
};

const daily = (userId, q) =>
  buildSeries(userId, {
    unit: 'day',
    count: q.days ?? 30,
    format: '%Y-%m-%d',
    override: q.timezone,
  });

const weekly = (userId, q) =>
  buildSeries(userId, {
    unit: 'week',
    count: q.weeks ?? 12,
    format: '%G-W%V',
    override: q.timezone,
  });

const monthly = (userId, q) =>
  buildSeries(userId, {
    unit: 'month',
    count: q.months ?? 12,
    format: '%Y-%m',
    override: q.timezone,
  });

const yearly = (userId, q) =>
  buildSeries(userId, {
    unit: 'year',
    count: q.years ?? 5,
    format: '%Y',
    override: q.timezone,
  });

// --- Category breakdown ------------------------------------------------

const periodToSince = (period) => {
  const d = new Date();
  switch (period) {
    case 'today': d.setUTCHours(0, 0, 0, 0); return d;
    case 'week':  d.setUTCDate(d.getUTCDate() - 6); d.setUTCHours(0, 0, 0, 0); return d;
    case 'year':  d.setUTCMonth(0, 1); d.setUTCHours(0, 0, 0, 0); return d;
    case 'month':
    default:      d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d;
  }
};

const categoryBreakdown = async (userId, q = {}) => {
  const tz = await resolveTimezone(userId, q.timezone);
  const currency = await resolveCurrency(userId);
  const userObj = oid(userId);

  const from = q.from ? new Date(q.from) : periodToSince(q.period || 'month');
  const to = q.to ? new Date(q.to) : new Date();

  const items = await Expense.aggregate([
    { $match: { user: userObj, deletedAt: null, date: { $gte: from, $lte: to } } },
    { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { amount: -1 } },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        amount: 1,
        count: 1,
        category: {
          $cond: [
            { $ifNull: ['$category._id', false] },
            {
              id: { $toString: '$category._id' },
              name: '$category.name',
              icon: '$category.icon',
              color: '$category.color',
            },
            null,
          ],
        },
      },
    },
  ]);

  const total = items.reduce((s, x) => s + x.amount, 0);
  const withPct = items.map((x) => ({
    ...x,
    pct: total > 0 ? Math.round((x.amount / total) * 10000) / 100 : 0,
  }));

  return {
    timezone: tz,
    currency,
    range: { from, to, period: q.period || (q.from ? 'custom' : 'month') },
    total,
    items: withPct,
  };
};

// --- Trends (rolling daily) --------------------------------------------

const trends = async (userId, q = {}) => {
  const days = q.days ?? 90;
  const base = await buildSeries(userId, {
    unit: 'day',
    count: days,
    format: '%Y-%m-%d',
    override: q.timezone,
  });

  // Compare current half vs previous half for a quick momentum signal.
  const half = Math.floor(base.items.length / 2);
  const previousHalf = base.items.slice(0, half).reduce((s, x) => s + x.amount, 0);
  const currentHalf = base.items.slice(half).reduce((s, x) => s + x.amount, 0);
  const changePct = previousHalf > 0
    ? Math.round(((currentHalf - previousHalf) / previousHalf) * 10000) / 100
    : null;

  return {
    ...base,
    momentum: {
      previousHalf,
      currentHalf,
      changePct,
    },
  };
};

// --- Spending Calendar (Feature 7) ------------------------------------
//
// Per-day totals over an arbitrary [from, to] window. Bucketing is
// done in the user's timezone so a user in IST sees the day they
// actually spent the money on, not the UTC midnight that follows.

const CALENDAR_MAX_DAYS = 60;

const calendar = async (userId, q = {}) => {
  const tz = await resolveTimezone(userId, q.timezone);
  const currency = await resolveCurrency(userId);
  const from = new Date(q.from);
  const to = new Date(q.to);

  // Server-side ceiling on range — Joi already caps at 60d, but enforce
  // again to defend against future validator drift.
  const spanDays = Math.ceil((to.getTime() - from.getTime()) / 86400_000);
  if (spanDays > CALENDAR_MAX_DAYS) {
    const e = new Error(`Calendar range cannot exceed ${CALENDAR_MAX_DAYS} days`);
    e.statusCode = 400;
    throw e;
  }

  const items = await Expense.aggregate([
    {
      $match: {
        user: oid(userId),
        deletedAt: null,
        date: { $gte: from, $lte: to },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: tz } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        total: 1,
        count: 1,
      },
    },
  ]);

  // Densify zero-spend days so the calendar UI doesn't have to do it.
  const dense = [];
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(0, 0, 0, 0);
  const byDate = new Map(items.map((i) => [i.date, i]));
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    const hit = byDate.get(key);
    dense.push(hit || { date: key, total: 0, count: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const total = items.reduce((s, x) => s + x.total, 0);
  const txns = items.reduce((s, x) => s + x.count, 0);

  return {
    timezone: tz,
    currency,
    range: { from, to },
    items: dense,
    total,
    count: txns,
  };
};

module.exports = {
  dashboard,
  daily,
  weekly,
  monthly,
  yearly,
  categoryBreakdown,
  trends,
  calendar,
};
