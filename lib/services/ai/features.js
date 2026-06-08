// Feature extraction for AI insights.
//
// Pure deterministic math over the user's expense + budget + goal
// data. The output is a structured "feature pack" the detector layer
// turns into individual insights — and the LLM later turns into prose.
//
// IMPORTANT: never include free-text fields (note, attachmentUrl,
// merchant) in the output. Only aggregated numerics + category names.
// The LLM contract is "narrate these numbers"; it does not see PII.

const mongoose = require('mongoose');
const Expense = require('../../models/Expense');
const Budget = require('../../models/Budget');
const Category = require('../../models/Category');
const { SavingsGoal } = require('../../models/SavingsGoal');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const _periodRange = (year, month) => ({
  from: new Date(Date.UTC(year, month - 1, 1)),
  to: new Date(Date.UTC(year, month, 1)),
});

// ---------- Building blocks ----------

const _monthlyByCategory = async (userId, year, month) => {
  const { from, to } = _periodRange(year, month);
  const rows = await Expense.aggregate([
    {
      $match: {
        user: oid(userId),
        deletedAt: null,
        date: { $gte: from, $lt: to },
      },
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);
  return rows; // [{ _id: catId|null, total, count }]
};

const _categoryDeltaMoM = (current, previous) => {
  const prevMap = new Map(previous.map((r) => [String(r._id), r]));
  const out = [];
  for (const cur of current) {
    const key = String(cur._id);
    const prev = prevMap.get(key);
    const prevTotal = prev?.total || 0;
    const delta = cur.total - prevTotal;
    const pct = prevTotal > 0 ? (delta / prevTotal) * 100 : null;
    out.push({
      categoryId: cur._id ? key : null,
      current: cur.total,
      previous: prevTotal,
      delta,
      pct: pct == null ? null : Math.round(pct * 10) / 10,
    });
  }
  return out;
};

// Std-dev based anomaly detection over the user's last 60 days of
// expenses. Returns the *biggest* outliers (per amount), capped at 3.
const _recentAnomalies = async (userId, now) => {
  const since = new Date(now.getTime() - 60 * 86400_000);
  const rows = await Expense.find({
    user: oid(userId),
    deletedAt: null,
    date: { $gte: since },
  })
    .select('amount date category')
    .lean();

  if (rows.length < 10) return [];

  const amounts = rows.map((r) => r.amount);
  const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
  const variance =
    amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
  const std = Math.sqrt(variance);
  if (std === 0) return [];

  const anomalies = rows
    .map((r) => ({
      amount: r.amount,
      categoryId: r.category ? String(r.category) : null,
      date: r.date,
      zScore: (r.amount - mean) / std,
    }))
    .filter((x) => x.zScore >= 2.5)
    .sort((a, b) => b.zScore - a.zScore)
    .slice(0, 3);

  return anomalies;
};

// ---------- Pack ----------

const build = async (userId, { now = new Date() } = {}) => {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [currentByCat, previousByCat, anomalies, activeGoals] = await Promise.all([
    _monthlyByCategory(userId, year, month),
    _monthlyByCategory(userId, prevYear, prevMonth),
    _recentAnomalies(userId, now),
    SavingsGoal.find({
      user: oid(userId),
      deletedAt: null,
      status: 'active',
    })
      .select('name targetAmount currentAmount deadline')
      .lean(),
  ]);

  const deltas = _categoryDeltaMoM(currentByCat, previousByCat);

  // Resolve category names ONCE so the LLM prompt has human-readable
  // labels — and so the mobile UI doesn't have to re-fetch them.
  const allCatIds = new Set();
  [...deltas, ...anomalies].forEach((row) => {
    if (row.categoryId) allCatIds.add(row.categoryId);
  });
  const catDocs = await Category.find({ _id: { $in: [...allCatIds].map(oid) } })
    .select('name icon color')
    .lean();
  const catLookup = new Map(
    catDocs.map((c) => [String(c._id), { id: String(c._id), name: c.name, icon: c.icon, color: c.color }])
  );

  const decorate = (row) => ({
    ...row,
    category: row.categoryId ? catLookup.get(row.categoryId) || null : null,
  });

  return {
    period: { year, month, prevYear, prevMonth },
    deltas: deltas.map(decorate).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    anomalies: anomalies.map(decorate),
    goals: activeGoals.map((g) => ({
      id: String(g._id),
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount || 0,
      deadline: g.deadline,
      progressPct: g.targetAmount > 0
        ? Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)
        : 0,
    })),
  };
};

module.exports = { build };
