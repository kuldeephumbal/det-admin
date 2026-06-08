// Cash-flow forecast (Feature 18 — premium).
//
// Projects the user's running balance over the next 30 days by
// combining:
//   1. CURRENT balance — sum of all non-archived, non-excluded accounts'
//      `cachedBalance` (i.e. net worth right now).
//   2. KNOWN scheduled outflows — bills due, recurring expenses,
//      auto-contributions to savings goals, all with concrete dates.
//   3. UNKNOWN discretionary spend — the user's average daily spend
//      over the last 30 days, projected forward as a flat rate.
//
// Returned shape: history[30] + forecast[30], each an array of
// `{ date, balance, scheduled?: [...] }`. The mobile UI renders this
// as a line chart with a dashed forecast portion.

const mongoose = require('mongoose');
const Account = require('../../models/Account');
const Expense = require('../../models/Expense');
const Bill = require('../../models/Bill');
const RecurringExpense = require('../../models/RecurringExpense');
const { SavingsGoal } = require('../../models/SavingsGoal');
const User = require('../../models/User');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// Forecast horizon in days. Wallet typically shows 30 — short enough
// that the linear-rate assumption holds, long enough to capture monthly
// bill cycles.
const FORECAST_DAYS = 30;
const HISTORY_DAYS = 30;

const _startOfDay = (d) => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

// Helpers that derive a sortable yyyy-mm-dd key from a Date.
const _isoKey = (d) => d.toISOString().slice(0, 10);

const generate = async (userId, { now = new Date() } = {}) => {
  const userObj = oid(userId);
  const today = _startOfDay(now);
  const horizonEnd = new Date(today.getTime() + FORECAST_DAYS * 86400_000);
  const historyStart = new Date(today.getTime() - HISTORY_DAYS * 86400_000);

  // 1. Net worth — current balance, currency-blind because forecast UI
  //    only renders the user's display currency. Multi-currency users
  //    will see imperfect numbers until FX lands.
  const accounts = await Account.find({
    user: userObj,
    deletedAt: null,
    isArchived: false,
    excludeFromTotals: false,
  })
    .select('cachedBalance currency')
    .lean();

  const user = await User.findById(userObj).select('preferences.currency').lean();
  const displayCurrency = user?.preferences?.currency || 'INR';
  const startBalance = accounts
    .filter((a) => (a.currency || 'INR') === displayCurrency)
    .reduce((s, a) => s + (a.cachedBalance || 0), 0);

  // 2. Daily discretionary average — last 30 days of expenses that
  //    aren't tagged as transfer / debt-repayment (those are internal
  //    balance moves, not actual outflows).
  const historyAgg = await Expense.aggregate([
    {
      $match: {
        user: userObj,
        deletedAt: null,
        date: { $gte: historyStart, $lt: today },
        source: { $nin: ['transfer', 'debt-repayment'] },
        amount: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$date' },
        },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const historyByDate = new Map(historyAgg.map((r) => [r._id, r.total]));
  const totalHistorical = historyAgg.reduce((s, r) => s + r.total, 0);
  const dailyAverage = totalHistorical / HISTORY_DAYS;

  // 3. Scheduled outflows for the forecast window.
  const [bills, recurringRows, goalsWithRules] = await Promise.all([
    Bill.find({
      user: userObj,
      deletedAt: null,
      paidAt: null,
      dueDate: { $gte: today, $lte: horizonEnd },
    })
      .select('name amount dueDate')
      .lean(),
    RecurringExpense.find({
      user: userObj,
      deletedAt: null,
      isActive: true,
      nextRunAt: { $gte: today, $lte: horizonEnd },
    })
      .select('title amount nextRunAt')
      .lean(),
    SavingsGoal.find({
      user: userObj,
      deletedAt: null,
      status: 'active',
      'contributionRule.nextRunAt': { $gte: today, $lte: horizonEnd },
    })
      .select('name contributionRule')
      .lean(),
  ]);

  // Build per-day scheduled outflow map.
  const scheduled = new Map(); // dateKey → [{ source, label, amount }]
  const addScheduled = (date, item) => {
    const key = _isoKey(_startOfDay(date));
    if (!scheduled.has(key)) scheduled.set(key, []);
    scheduled.get(key).push(item);
  };
  for (const b of bills) {
    addScheduled(b.dueDate, { source: 'bill', label: b.name, amount: b.amount });
  }
  for (const r of recurringRows) {
    addScheduled(r.nextRunAt, {
      source: 'recurring',
      label: r.title,
      amount: r.amount,
    });
  }
  for (const g of goalsWithRules) {
    if (g.contributionRule?.nextRunAt && g.contributionRule.amount > 0) {
      addScheduled(g.contributionRule.nextRunAt, {
        source: 'goal',
        label: g.name,
        amount: g.contributionRule.amount,
      });
    }
  }

  // ---------- Build history (last 30 days) ----------
  //
  // Work backwards from today's balance to estimate what each historical
  // day's starting balance was. This is a simplification — accurate
  // history would require per-account-per-day snapshots — but it's
  // accurate enough to plot the trend that flows into the forecast.
  const history = [];
  let runningBalance = startBalance;
  // Push today first, then walk back day-by-day.
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const day = new Date(today.getTime() - i * 86400_000);
    const key = _isoKey(day);
    const daySpend = historyByDate.get(key) || 0;
    history.unshift({
      date: day,
      balance: Math.round(runningBalance * 100) / 100,
      spend: Math.round(daySpend * 100) / 100,
    });
    // Yesterday's balance was today's + what was spent today.
    runningBalance += daySpend;
  }

  // ---------- Build forecast (next 30 days) ----------
  const forecast = [];
  let projected = startBalance;
  for (let i = 1; i <= FORECAST_DAYS; i++) {
    const day = new Date(today.getTime() + i * 86400_000);
    const key = _isoKey(day);
    const dayScheduled = scheduled.get(key) || [];
    const scheduledTotal = dayScheduled.reduce((s, x) => s + x.amount, 0);
    projected -= dailyAverage + scheduledTotal;
    forecast.push({
      date: day,
      balance: Math.round(projected * 100) / 100,
      scheduled: dayScheduled.map((x) => ({
        source: x.source,
        // Labels can carry user-personal context (bill name). We DO
        // surface them to the user themselves here — the privacy
        // boundary is only relevant for the admin layer, which never
        // reads this endpoint.
        label: x.label,
        amount: x.amount,
      })),
      projectedDailySpend: Math.round(dailyAverage * 100) / 100,
    });
  }

  // ---------- Health summary ----------
  const lowPoint = forecast.reduce(
    (acc, d) => (d.balance < acc.balance ? d : acc),
    { date: today, balance: startBalance }
  );
  const endOfMonth = forecast[forecast.length - 1];
  const totalScheduledOutflow = forecast.reduce(
    (s, d) => s + d.scheduled.reduce((ss, x) => ss + x.amount, 0),
    0
  );

  return {
    currency: displayCurrency,
    startBalance: Math.round(startBalance * 100) / 100,
    dailyAverage: Math.round(dailyAverage * 100) / 100,
    history,
    forecast,
    summary: {
      lowPointDate: lowPoint.date,
      lowPointBalance: Math.round(lowPoint.balance * 100) / 100,
      endBalance: endOfMonth?.balance ?? startBalance,
      totalScheduledOutflow: Math.round(totalScheduledOutflow * 100) / 100,
      // Did the projection ever dip below zero? Useful for the "Heads up,
      // you might overdraft" banner.
      goesNegative: forecast.some((d) => d.balance < 0),
      goesNegativeDate: forecast.find((d) => d.balance < 0)?.date ?? null,
    },
  };
};

module.exports = { generate };
