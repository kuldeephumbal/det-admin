const Category = require('../models/Category');
const Expense = require('../models/Expense');
const ApiError = require('../utils/ApiError');

const toPublic = (doc) => ({
  id: String(doc._id),
  name: doc.name,
  icon: doc.icon,
  color: doc.color,
  isDefault: !!doc.isDefault,
  isCustom: !!doc.user,
  isActive: doc.isActive !== false,
  sortOrder: doc.sortOrder || 0,
});

const listForUser = async (userId, { includeInactive = false } = {}) => {
  const filter = {
    deletedAt: null,
    $or: [{ user: userId }, { isDefault: true, user: null }],
  };
  if (!includeInactive) filter.isActive = true;

  const docs = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  return docs.map(toPublic);
};

const create = async (userId, payload) => {
  const doc = await Category.create({
    name: payload.name,
    icon: payload.icon,
    color: payload.color,
    sortOrder: payload.sortOrder ?? 0,
    user: userId,
    isDefault: false,
  });
  return toPublic(doc);
};

const update = async (userId, id, patch) => {
  // Filter excludes system defaults (user=null, isDefault=true) so users can't
  // mutate shared rows even with a guessed id.
  const doc = await Category.findOneAndUpdate(
    { _id: id, user: userId, deletedAt: null, isDefault: false },
    { $set: patch },
    { new: true, runValidators: true, context: 'query' }
  );
  if (!doc) throw ApiError.notFound('Category not found');
  return toPublic(doc);
};

const softDelete = async (userId, id, { force = false } = {}) => {
  const cat = await Category.findOne({
    _id: id,
    user: userId,
    deletedAt: null,
    isDefault: false,
  });
  if (!cat) throw ApiError.notFound('Category not found');

  const inUse = await Expense.countDocuments({
    user: userId,
    category: id,
    deletedAt: null,
  });

  if (inUse > 0 && !force) {
    throw ApiError.conflict(
      `${inUse} expense${inUse === 1 ? ' uses' : 's use'} this category. ` +
        `Pass force=true to reassign them to "Other".`,
      { inUse }
    );
  }

  let reassignedTo = null;
  if (inUse > 0) {
    const other = await Category.findOne({
      user: null,
      isDefault: true,
      name: 'Other',
      deletedAt: null,
    });
    if (!other) {
      throw ApiError.conflict(
        'Cannot reassign expenses — "Other" default category is missing. Run the seed script.'
      );
    }
    await Expense.updateMany(
      { user: userId, category: id, deletedAt: null },
      { $set: { category: other._id } }
    );
    reassignedTo = String(other._id);
  }

  cat.deletedAt = new Date();
  await cat.save();

  return { id: String(cat._id), reassigned: inUse, reassignedTo };
};

module.exports = { listForUser, create, update, softDelete };
