// SMS parser rules service.
//
// Phase 4 Feature 11 — server side. The bulk of the SMS work happens
// in the Flutter background isolate (deferred); the server's only
// job is to publish the rules catalog and let admins manage it.

const SmsParserRule = require('../models/SmsParserRule');
const ApiError = require('../utils/ApiError');
const { parsePagination } = require('../utils/pagination');

const toPublic = (r) => ({
  id: String(r._id),
  name: r.name,
  bankName: r.bankName || '',
  senderPattern: r.senderPattern,
  amountRegex: r.amountRegex,
  merchantRegex: r.merchantRegex || '',
  datePattern: r.datePattern || '',
  currency: r.currency,
  version: r.version,
  isActive: r.isActive !== false,
  updatedAt: r.updatedAt,
});

// Public list for mobile — active rules only by default. Mobile pulls
// this on app start (and on a periodic refresh) so a rule rolled out
// via admin propagates without a client update.
const listForMobile = async () => {
  const rows = await SmsParserRule.find({ isActive: true })
    .sort({ updatedAt: -1 })
    .lean();
  return {
    items: rows.map(toPublic),
    fetchedAt: new Date(),
  };
};

// Admin list — supports paging + filtering + show-all.
const listForAdmin = async (q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const filter = {};
  if (q.activeOnly === true || q.activeOnly === 'true') filter.isActive = true;
  if (q.bankName) filter.bankName = q.bankName;
  const [items, total] = await Promise.all([
    SmsParserRule.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    SmsParserRule.countDocuments(filter),
  ]);
  return { items: items.map(toPublic), page, limit, total };
};

const create = async (payload) => {
  const doc = await SmsParserRule.create(payload);
  return toPublic(doc);
};

const update = async (id, patch) => {
  const doc = await SmsParserRule.findByIdAndUpdate(
    id,
    { $set: patch },
    { new: true, runValidators: true, context: 'query' }
  );
  if (!doc) throw ApiError.notFound('SMS rule not found');
  return toPublic(doc);
};

const remove = async (id) => {
  const doc = await SmsParserRule.findByIdAndDelete(id);
  if (!doc) throw ApiError.notFound('SMS rule not found');
};

module.exports = { listForMobile, listForAdmin, create, update, remove };
