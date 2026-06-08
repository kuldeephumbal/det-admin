const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const { parsePagination, parseSort } = require('../utils/pagination');

const SORTABLE = ['date', 'amount', 'createdAt'];

const ensureCategoryAccessible = async (userId, categoryId) => {
  const cat = await Category.findOne({
    _id: categoryId,
    deletedAt: null,
    isActive: true,
    $or: [{ user: userId }, { isDefault: true, user: null }],
  }).lean();
  if (!cat) throw ApiError.badRequest('Invalid category');
  return cat;
};

const toPublic = (doc) => ({
  id: String(doc._id),
  amount: doc.amount,
  currency: doc.currency,
  category: doc.category && doc.category._id
    ? { id: String(doc.category._id), name: doc.category.name, icon: doc.category.icon, color: doc.category.color }
    : String(doc.category),
  date: doc.date,
  note: doc.note || '',
  paymentMethod: doc.paymentMethod,
  tags: doc.tags || [],
  attachmentUrl: doc.attachmentUrl || null,
  recurringSource: doc.recurringSource ? String(doc.recurringSource) : null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const create = async (userId, payload) => {
  await ensureCategoryAccessible(userId, payload.category);

  // Default the account to the user's seeded Cash account so older
  // mobile builds (no picker UI yet) keep working. ensureDefaultForUser
  // is idempotent — cheap to call on every write.
  const accountService = require('./account.service');
  let { account } = payload;
  if (!account) {
    const fallback = await accountService.ensureDefaultForUser(userId);
    account = fallback._id;
  }

  const doc = await Expense.create({ ...payload, user: userId, account });
  await doc.populate({ path: 'category', select: 'name icon color' });

  // Threshold check is fire-and-forget — never block the response, never
  // throw out of the request. budget.service swallows its own errors.
  // Loaded lazily to avoid a circular require during the module graph init.
  const budgetService = require('./budget.service');
  budgetService.checkAndAlert(userId, doc).catch(() => {});

  // Keep the Account's cached balance fresh.
  if (doc.account) accountService.touchAccount(doc.account).catch(() => {});

  return toPublic(doc);
};

const buildListFilter = async (userId, q) => {
  // Shared-accounts (Feature 16): the caller sees their own expenses
  // PLUS every expense booked on an account they're an active member
  // of. We OR those two conditions inside a single Mongo filter so
  // pagination/count stay accurate.
  const sharing = require('./sharing.service');
  const accessibleIds = await sharing.accessibleAccountIds(userId);
  const ownerOid = new mongoose.Types.ObjectId(String(userId));

  const filter = {
    deletedAt: null,
    $or: [
      { user: ownerOid },
      { account: { $in: accessibleIds } },
    ],
  };

  if (q.from || q.to) {
    filter.date = {};
    if (q.from) filter.date.$gte = new Date(q.from);
    if (q.to) filter.date.$lte = new Date(q.to);
  }
  if (q.category) filter.category = new mongoose.Types.ObjectId(String(q.category));
  if (q.paymentMethod) filter.paymentMethod = q.paymentMethod;
  if (q.minAmount !== undefined || q.maxAmount !== undefined) {
    filter.amount = {};
    if (q.minAmount !== undefined) filter.amount.$gte = Number(q.minAmount);
    if (q.maxAmount !== undefined) filter.amount.$lte = Number(q.maxAmount);
  }
  if (q.tag) filter.tags = q.tag;
  if (q.search) {
    // Case-insensitive substring on note. For full-text use Mongo text index in Phase 9.
    filter.note = { $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  return filter;
};

const list = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, SORTABLE, { date: -1 });
  const filter = await buildListFilter(userId, query);

  const [items, total] = await Promise.all([
    Expense.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'category', select: 'name icon color' })
      .lean({ getters: true }),
    Expense.countDocuments(filter),
  ]);

  return {
    items: items.map(toPublic),
    page,
    limit,
    total,
  };
};

const getById = async (userId, id) => {
  const doc = await Expense.findOne({ _id: id, deletedAt: null })
    .populate({ path: 'category', select: 'name icon color' })
    .lean({ getters: true });
  if (!doc) throw ApiError.notFound('Expense not found');

  // Allow if caller owns the row OR has access to the underlying account.
  if (String(doc.user) !== String(userId)) {
    const sharing = require('./sharing.service');
    const access = doc.account
      ? await sharing.isAccessible(userId, doc.account)
      : { accessible: false };
    if (!access.accessible) throw ApiError.notFound('Expense not found');
  }
  return toPublic(doc);
};

const update = async (userId, id, patch) => {
  if (patch.category) await ensureCategoryAccessible(userId, patch.category);

  // Capture the previous account so we can refresh BOTH cached
  // balances when an expense moves between accounts.
  const before = await Expense.findOne({ _id: id, user: userId }).select('account').lean();

  const doc = await Expense.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null },
    { $set: patch },
    { new: true, runValidators: true, context: 'query' }
  )
    .populate({ path: 'category', select: 'name icon color' });

  if (!doc) throw ApiError.notFound('Expense not found');

  const accountService = require('./account.service');
  const touched = new Set();
  if (before?.account) touched.add(String(before.account));
  if (doc.account) touched.add(String(doc.account));
  for (const id of touched) accountService.touchAccount(id).catch(() => {});

  return toPublic(doc);
};

const softDelete = async (userId, id) => {
  const doc = await Expense.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Expense not found');
  if (doc.account) {
    const accountService = require('./account.service');
    accountService.touchAccount(doc.account).catch(() => {});
  }
};

const summary = async (userId, { from, to } = {}) => {
  const [agg] = await Expense.sumForUser(userId, { from, to });
  return { total: agg?.total || 0, count: agg?.count || 0 };
};

module.exports = { create, list, getById, update, softDelete, summary };
