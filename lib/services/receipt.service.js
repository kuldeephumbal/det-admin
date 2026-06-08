// Receipt scanner service.
//
// Phase 2 Feature 6 — premium-gated. Lifecycle:
//
//   enqueue(file)        → ReceiptScan { status: 'pending' }
//      ↓                    (worker tick — cron @ 1/min)
//   processPending(N)    → status: 'processing' → 'completed' | 'failed'
//      ↓
//   attachToExpense(...) → user confirms; creates Expense linked back.
//
// Storage + OCR providers are pluggable (see lib/services/storage,
// lib/services/ocr). Dev defaults: local filesystem storage,
// no OCR (the worker stamps `failed` with a 'OCR_NOT_CONFIGURED'
// message until creds land — so the workflow is observably alive in
// dev without burning real OCR cost).

const crypto = require('crypto');
const mongoose = require('mongoose');
const { ReceiptScan } = require('../models/ReceiptScan');
const Expense = require('../models/Expense');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { parsePagination } = require('../utils/pagination');
const { NOTIFICATION_TYPES } = require('../config/constants');
const { MAX_RECEIPT_SIZE_BYTES, ALLOWED_RECEIPT_MIME } = require('../validators/receipt.validator');
const storage = require('./storage');
const ocr = require('./ocr');
const notifications = require('./notification.service');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

const toPublic = (r) => ({
  id: String(r._id),
  imageUrl: r.imageUrl,
  thumbnailUrl: r.thumbnailUrl || '',
  status: r.status,
  ocrProvider: r.ocrProvider || '',
  confidence: r.confidence || 0,
  extracted: r.status === 'completed'
    ? {
        merchant: r.extracted?.merchant || '',
        total: r.extracted?.total || 0,
        currency: r.extracted?.currency || '',
        date: r.extracted?.date || null,
        lineItems: r.extracted?.lineItems || [],
      }
    : null,
  expenseId: r.expense ? String(r.expense) : null,
  error: r.error || '',
  createdAt: r.createdAt,
  completedAt: r.completedAt || null,
});

// ---------- Upload / enqueue ----------

// `file` is the WHATWG `File` returned by Next.js `formData()`. The
// route layer is responsible for pulling it out; the service does the
// size + mime check, hashes the bytes for the storage key, writes to
// the storage backend, and inserts the ReceiptScan row.
const enqueue = async (userId, file) => {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw ApiError.badRequest('Missing or invalid file');
  }
  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    throw ApiError.badRequest(`File exceeds ${MAX_RECEIPT_SIZE_BYTES} bytes`);
  }
  const contentType = file.type || '';
  if (!ALLOWED_RECEIPT_MIME.includes(contentType)) {
    throw ApiError.badRequest(`Unsupported content type: ${contentType || 'unknown'}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Content-addressed key so re-uploading the same image dedupes at
  // the storage layer (and keeps the DB clean if the user retries).
  const ext = contentType.split('/')[1] || 'bin';
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
  const key = `${hash}.${ext}`;

  const adapter = storage.get();
  const { url, key: storedKey } = await adapter.put({
    key,
    buffer,
    contentType,
    userId,
  });

  const doc = await ReceiptScan.create({
    user: userId,
    imageUrl: url,
    storageKey: storedKey,
    contentType,
    sizeBytes: buffer.length,
    status: 'pending',
  });

  return toPublic(doc);
};

const list = async (userId, q = {}) => {
  const { page, limit, skip } = parsePagination(q);
  const filter = { user: oid(userId), deletedAt: null };
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([
    ReceiptScan.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ReceiptScan.countDocuments(filter),
  ]);
  return { items: items.map(toPublic), page, limit, total };
};

const get = async (userId, id) => {
  const doc = await ReceiptScan.findOne({ _id: id, user: oid(userId), deletedAt: null }).lean();
  if (!doc) throw ApiError.notFound('Receipt not found');
  return toPublic(doc);
};

const softDelete = async (userId, id) => {
  const doc = await ReceiptScan.findOneAndUpdate(
    { _id: id, user: oid(userId), deletedAt: null },
    { $set: { deletedAt: new Date() } }
  );
  if (!doc) throw ApiError.notFound('Receipt not found');
  // Best-effort blob cleanup. Don't fail the API call if storage hiccups.
  try {
    const adapter = storage.get();
    await adapter.delete(doc.storageKey, userId);
  } catch (err) {
    logger.warn('receipt blob delete failed', { receiptId: String(doc._id), message: err.message });
  }
};

// ---------- Worker ----------
//
// Picks at most `batch` pending scans, marks them processing, then
// calls the OCR adapter. On success, status → completed and the
// extracted fields are persisted. On failure, status → failed with
// the error message (TTL'd to 30 days by the model index).

const processPending = async ({ batch = 5 } = {}) => {
  const provider = ocr.get();

  let claimed = 0;
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < batch; i++) {
    // Atomically pick the next pending job and flip it to processing.
    // Mongo's findOneAndUpdate is the closest we get to SELECT FOR
    // UPDATE without dragging in a real job queue (deferred to a
    // later phase per plan §0 principle 7).
    const doc = await ReceiptScan.findOneAndUpdate(
      { status: 'pending', deletedAt: null },
      { $set: { status: 'processing' }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, new: true }
    );
    if (!doc) break;
    claimed += 1;

    try {
      const storageAdapter = storage.get();
      const { buffer } = await storageAdapter.get(doc.storageKey, doc.user);
      const extracted = await provider.extract({ buffer, contentType: doc.contentType });

      doc.extracted = {
        merchant: extracted.merchant || '',
        total: extracted.total || 0,
        currency: extracted.currency || '',
        date: extracted.date || null,
        lineItems: extracted.lineItems || [],
        raw: extracted.raw || null,
      };
      doc.confidence = extracted.confidence || 0;
      doc.ocrProvider = 'vision';
      doc.status = 'completed';
      doc.completedAt = new Date();
      doc.error = '';
      await doc.save();
      completed += 1;

      // Data-only push so the mobile app can refresh the row without
      // showing a banner — UX wants the receipt to "just appear" in
      // the upload sheet.
      notifications
        .dispatch({
          user: doc.user,
          type: NOTIFICATION_TYPES.SYSTEM,
          title: 'Receipt ready',
          body: doc.extracted.merchant
            ? `Extracted ${doc.extracted.merchant} — tap to confirm.`
            : 'Tap to review the scanned receipt.',
          data: { receiptId: String(doc._id) },
          deepLink: `/receipts/${doc._id}`,
        })
        .catch(() => {});
    } catch (err) {
      doc.status = 'failed';
      doc.error = err.message || 'OCR failed';
      await doc.save();
      failed += 1;
      logger.warn('receipt OCR failed', { receiptId: String(doc._id), message: err.message });
    }
  }

  return { claimed, completed, failed };
};

// ---------- Convert to Expense ----------
//
// Called by the mobile pre-fill sheet: the user reviewed the OCR
// result, optionally corrected it, and confirms. We mint an Expense
// linked back to the scan via `attachmentUrl`.

const attachToExpense = async (userId, receiptId, overrides = {}) => {
  const scan = await ReceiptScan.findOne({
    _id: receiptId,
    user: oid(userId),
    deletedAt: null,
  });
  if (!scan) throw ApiError.notFound('Receipt not found');
  if (scan.status !== 'completed') {
    throw ApiError.badRequest(`Receipt is ${scan.status}, not completed`);
  }
  if (scan.expense) {
    throw ApiError.conflict('Receipt already attached to an expense', {
      field: 'expense',
      value: String(scan.expense),
    });
  }

  const expense = await Expense.create({
    user: userId,
    amount: overrides.amount ?? scan.extracted.total,
    currency: overrides.currency || scan.extracted.currency || 'INR',
    category: overrides.category || null,
    date: overrides.date || scan.extracted.date || new Date(),
    note: overrides.note || scan.extracted.merchant || '',
    paymentMethod: overrides.paymentMethod || 'card',
    attachmentUrl: scan.imageUrl,
  });

  scan.expense = expense._id;
  await scan.save();

  return { receipt: toPublic(scan), expenseId: String(expense._id) };
};

module.exports = {
  enqueue,
  list,
  get,
  softDelete,
  processPending,
  attachToExpense,
};
