// Split-expenses: shared-expense CRUD + split math + derived balances.
//
// `computeSplits` is pure and unit-tested. Balances are derived on read
// from SplitExpense + Settlement (see split-balance.service) so edits and
// deletes stay correct with no stored balance to patch.

const mongoose = require('mongoose');
const SplitExpense = require('../models/SplitExpense');
const Settlement = require('../models/Settlement');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/pagination');
const { assertAccess, memberUserIds } = require('./split-group.service');
const { derive, simplify, round2 } = require('./split-balance.service');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// Allocate `cents` proportionally to each split's weight, sending the
// rounding remainder to the largest fractional parts so the sum is exact.
const _allocateByWeight = (cents, splits) => {
  const total = splits.reduce((a, s) => a + Number(s.value), 0);
  const rows = splits.map((s) => {
    const exact = (Number(s.value) / total) * cents;
    const floor = Math.floor(exact);
    return { user: String(s.user), shareValue: Number(s.value), floor, frac: exact - floor };
  });
  let rem = cents - rows.reduce((a, r) => a + r.floor, 0);
  const order = [...rows].sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && rem > 0; k += 1) {
    order[k].floor += 1;
    rem -= 1;
  }
  return rows.map((r) => ({ user: r.user, owed: r.floor / 100, shareValue: r.shareValue }));
};

// Turn a method + total + inputs into concrete per-member owed amounts.
// Pure (no DB). Throws ApiError on bad input (sums must match).
//   equal:      participants = [userId]
//   exact:      splits = [{ user, value }]  (value = owed amount)
//   percentage: splits = [{ user, value }]  (value = percent, must sum 100)
//   shares:     splits = [{ user, value }]  (value = weight, sum > 0)
const computeSplits = (method, amount, { participants = [], splits = [] } = {}) => {
  const cents = Math.round(Number(amount) * 100);
  if (!(cents > 0)) throw ApiError.badRequest('Amount must be greater than zero');

  if (method === 'equal') {
    const users = (participants || []).map(String);
    if (users.length === 0) throw ApiError.badRequest('Pick at least one participant');
    const base = Math.floor(cents / users.length);
    const rem = cents - base * users.length;
    return users.map((u, idx) => ({
      user: u,
      owed: (base + (idx < rem ? 1 : 0)) / 100,
      shareValue: null,
    }));
  }

  if (!splits || splits.length === 0) throw ApiError.badRequest('Provide a split for each person');

  if (method === 'exact') {
    const rows = splits.map((s) => ({ user: String(s.user), owed: round2(s.value), shareValue: Number(s.value) }));
    const sum = rows.reduce((a, r) => a + Math.round(r.owed * 100), 0);
    if (sum !== cents) throw ApiError.badRequest(`Split amounts must add up to the total (${amount})`);
    return rows;
  }

  if (method === 'percentage') {
    const totalPct = splits.reduce((a, s) => a + Number(s.value), 0);
    if (Math.abs(totalPct - 100) > 0.001) throw ApiError.badRequest('Percentages must add up to 100');
    return _allocateByWeight(cents, splits);
  }

  if (method === 'shares') {
    const totalShares = splits.reduce((a, s) => a + Number(s.value), 0);
    if (!(totalShares > 0)) throw ApiError.badRequest('Total shares must be greater than zero');
    return _allocateByWeight(cents, splits);
  }

  throw ApiError.badRequest('Unknown split method');
};

const toPublic = (e) => ({
  id: String(e._id),
  group: String(e.group),
  createdBy: String(e.createdBy),
  description: e.description,
  amount: e.amount,
  currency: e.currency,
  paidBy: String(e.paidBy),
  splitMethod: e.splitMethod,
  splits: (e.splits || []).map((s) => ({
    user: String(s.user),
    owed: s.owed,
    shareValue: s.shareValue == null ? null : s.shareValue,
  })),
  category: e.category ? String(e.category) : null,
  date: e.date,
  note: e.note || '',
  createdAt: e.createdAt,
  updatedAt: e.updatedAt,
});

const _validateMembers = (computed, paidBy, memberSet) => {
  if (!memberSet.has(String(paidBy))) throw ApiError.badRequest('The payer must be a group member');
  for (const r of computed) {
    if (!memberSet.has(String(r.user))) throw ApiError.badRequest('Everyone in the split must be a group member');
  }
};

const create = async (userId, groupId, body) => {
  const { group } = await assertAccess(userId, groupId);
  const memberSet = await memberUserIds(groupId);
  const method = body.splitMethod || 'equal';
  const computed = computeSplits(method, body.amount, {
    participants: body.participants,
    splits: body.splits,
  });
  _validateMembers(computed, body.paidBy, memberSet);

  const doc = await SplitExpense.create({
    group: groupId,
    createdBy: oid(userId),
    description: body.description,
    amount: round2(body.amount),
    currency: body.currency || group.currency,
    paidBy: oid(body.paidBy),
    splitMethod: method,
    splits: computed.map((r) => ({ user: oid(r.user), owed: r.owed, shareValue: r.shareValue })),
    category: body.category || null,
    date: body.date || new Date(),
    note: body.note || '',
  });
  return toPublic(doc);
};

const list = async (userId, groupId, q = {}) => {
  await assertAccess(userId, groupId);
  const { page, limit, skip } = parsePagination(q);
  const filter = { group: groupId, deletedAt: null };
  const [items, total] = await Promise.all([
    SplitExpense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    SplitExpense.countDocuments(filter),
  ]);
  return { items: items.map(toPublic), page, limit, total };
};

const get = async (userId, groupId, expenseId) => {
  await assertAccess(userId, groupId);
  const e = await SplitExpense.findOne({ _id: expenseId, group: groupId, deletedAt: null }).lean();
  if (!e) throw ApiError.notFound('Expense not found');
  return toPublic(e);
};

const update = async (userId, groupId, expenseId, patch) => {
  await assertAccess(userId, groupId);
  const e = await SplitExpense.findOne({ _id: expenseId, group: groupId, deletedAt: null });
  if (!e) throw ApiError.notFound('Expense not found');
  const memberSet = await memberUserIds(groupId);

  const recompute =
    patch.splitMethod !== undefined ||
    patch.amount !== undefined ||
    patch.participants !== undefined ||
    patch.splits !== undefined;

  if (recompute) {
    const method = patch.splitMethod || e.splitMethod;
    const amount = patch.amount !== undefined ? patch.amount : e.amount;
    // Fall back to the existing weighting if the client changed only the
    // amount/method and didn't resend participants/splits.
    let { participants, splits } = patch;
    if (method === 'equal' && !participants) participants = e.splits.map((s) => String(s.user));
    if (method !== 'equal' && !splits) {
      splits = e.splits.map((s) => ({ user: String(s.user), value: s.shareValue == null ? s.owed : s.shareValue }));
    }
    const computed = computeSplits(method, amount, { participants, splits });
    _validateMembers(computed, patch.paidBy !== undefined ? patch.paidBy : e.paidBy, memberSet);
    e.splits = computed.map((r) => ({ user: oid(r.user), owed: r.owed, shareValue: r.shareValue }));
    e.splitMethod = method;
    e.amount = round2(amount);
  }

  if (patch.paidBy !== undefined) {
    if (!memberSet.has(String(patch.paidBy))) throw ApiError.badRequest('The payer must be a group member');
    e.paidBy = oid(patch.paidBy);
  }
  for (const k of ['description', 'currency', 'note']) {
    if (patch[k] !== undefined) e[k] = patch[k];
  }
  if (patch.category !== undefined) e.category = patch.category || null;
  if (patch.date !== undefined) e.date = patch.date;

  await e.save();
  return toPublic(e);
};

const softDelete = async (userId, groupId, expenseId) => {
  await assertAccess(userId, groupId);
  const e = await SplitExpense.findOne({ _id: expenseId, group: groupId, deletedAt: null });
  if (!e) throw ApiError.notFound('Expense not found');
  e.deletedAt = new Date();
  await e.save();
};

// Derived balances for a group: net per person, raw per-pair debts, and
// the greedy "simplified" payment set. Names enriched for display.
const groupBalances = async (userId, groupId) => {
  const { group } = await assertAccess(userId, groupId);
  const [expenses, settlements] = await Promise.all([
    SplitExpense.find({ group: groupId, deletedAt: null }).select('paidBy splits').lean(),
    Settlement.find({ group: groupId, deletedAt: null }).select('from to amount').lean(),
  ]);
  const { net, pairs } = derive(
    expenses.map((e) => ({ paidBy: e.paidBy, splits: e.splits })),
    settlements
  );
  const simplified = simplify(net);

  const ids = new Set(Object.keys(net));
  [...pairs, ...simplified].forEach((p) => { ids.add(p.from); ids.add(p.to); });
  const users = await User.find({ _id: { $in: [...ids].map(oid) } })
    .select('name email avatarUrl')
    .lean();
  const umap = {};
  users.forEach((u) => { umap[String(u._id)] = { id: String(u._id), name: u.name, email: u.email, avatarUrl: u.avatarUrl || null }; });
  const who = (id) => umap[id] || { id };

  return {
    currency: group.currency,
    simplifyDebts: !!group.simplifyDebts,
    net: Object.entries(net).map(([u, v]) => ({ user: who(u), net: v })),
    raw: pairs.map((p) => ({ from: who(p.from), to: who(p.to), amount: p.amount })),
    simplified: simplified.map((p) => ({ from: who(p.from), to: who(p.to), amount: p.amount })),
  };
};

module.exports = {
  computeSplits,
  create,
  list,
  get,
  update,
  softDelete,
  groupBalances,
  toPublic,
};
