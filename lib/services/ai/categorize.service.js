// Auto-categorise on add (Feature 22).
//
// Two strategies, picked by the caller's plan:
//   - Free tier: per-user Naive Bayes trained on their last 500
//     expenses' `note → category` pairs. Lives entirely in this server
//     — note text never leaves the user's data boundary.
//   - Premium tier: same shape, but routed through the existing
//     lib/services/ai/llm.js Anthropic wrapper for better extraction.
//
// Privacy: this service ONLY ever reads a single user's own expense
// history. No cross-user training, no shared model — the suggester for
// user A would have to be retrained from scratch to help user B.

const mongoose = require('mongoose');
const Expense = require('../../models/Expense');
const Category = require('../../models/Category');
const logger = require('../../utils/logger');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

// How many recent expenses to consider when training. 500 is plenty
// for the user's typical merchant/note vocabulary; older rows drift
// (people change spending habits) and bloating the window doesn't
// help accuracy.
const TRAINING_WINDOW = 500;

// Minimum confidence we'll surface to the UI. Below this the response
// is `{ suggestion: null }` — better to skip than mis-suggest.
const MIN_CONFIDENCE = 0.45;

// Tokenise a note + merchant blob into lowercase word stems. Strips
// punctuation and short noise tokens.
const _tokenize = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !_STOPWORDS.has(t));

// Common English fillers that don't tell us anything about category.
const _STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'about',
  'paid', 'paid to', 'on', 'in', 'at', 'a', 'an', 'to', 'of',
]);

// Train an in-memory Naive Bayes for one user. Cheap enough to redo on
// every request — 500 rows × handful of tokens is microseconds. If
// suggestion latency becomes a bottleneck, cache the model keyed by
// (userId, last-expense-id) and rebuild on cache miss.
const _trainForUser = async (userId) => {
  const rows = await Expense.find({
    user: oid(userId),
    deletedAt: null,
    category: { $ne: null },
    // Only train on user-entered rows. Transfers and debt-repayments
    // shouldn't bias the suggester — their notes are usually generic
    // ("Transfer Cash → HDFC", "Repaid Alex") and would over-fit to
    // whatever the user happened to use last.
    source: { $in: ['manual', 'recurring', 'sms', 'ocr', 'bank-sync'] },
  })
    .sort({ createdAt: -1 })
    .limit(TRAINING_WINDOW)
    .select('note category')
    .lean();

  // Per-category token frequency + per-category doc count.
  const categoryCounts = new Map();
  const tokenCounts = new Map(); // Map<categoryId, Map<token, count>>
  const totalTokensByCategory = new Map();
  let totalDocs = 0;

  for (const r of rows) {
    if (!r.note || !r.category) continue;
    const tokens = _tokenize(r.note);
    if (tokens.length === 0) continue;

    const cat = String(r.category);
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    totalDocs += 1;

    if (!tokenCounts.has(cat)) tokenCounts.set(cat, new Map());
    const catTokens = tokenCounts.get(cat);
    for (const t of tokens) {
      catTokens.set(t, (catTokens.get(t) || 0) + 1);
      totalTokensByCategory.set(cat, (totalTokensByCategory.get(cat) || 0) + 1);
    }
  }

  return {
    categoryCounts,
    tokenCounts,
    totalTokensByCategory,
    totalDocs,
    vocabSize: new Set(
      [...tokenCounts.values()].flatMap((m) => [...m.keys()])
    ).size,
  };
};

// Score a tokenised input against a trained model. Returns the best
// category id + a normalised confidence in [0, 1], OR null when the
// model has insufficient training data.
const _scoreNaiveBayes = (tokens, model) => {
  if (model.totalDocs < 5 || tokens.length === 0) return null;

  // Log-space probabilities to avoid underflow on long notes.
  // For each category c:
  //   logP(c | tokens) = logP(c) + Σ logP(token | c)
  // P(token | c) uses Laplace smoothing with vocabSize as denominator.
  let best = { cat: null, score: -Infinity };
  let secondBest = -Infinity;
  for (const [cat, count] of model.categoryCounts.entries()) {
    const prior = Math.log(count / model.totalDocs);
    const catTotalTokens = model.totalTokensByCategory.get(cat) || 0;
    const denom = catTotalTokens + model.vocabSize;
    let score = prior;
    const catTokens = model.tokenCounts.get(cat) || new Map();
    for (const t of tokens) {
      const tokenCount = catTokens.get(t) || 0;
      score += Math.log((tokenCount + 1) / denom);
    }
    if (score > best.score) {
      secondBest = best.score;
      best = { cat, score };
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (best.cat === null) return null;

  // Confidence: how much better the best is vs second-best, normalised
  // through softmax-style logits. A run-away winner → confidence near 1;
  // a close call → near 0.5.
  const gap = best.score - secondBest;
  const confidence = secondBest === -Infinity ? 1 : 1 / (1 + Math.exp(-gap));

  return { categoryId: best.cat, confidence };
};

// ---------- Public API ----------

const suggest = async (userId, { note, merchant }) => {
  const text = [note, merchant].filter(Boolean).join(' ').trim();
  if (!text) return { suggestion: null };

  const tokens = _tokenize(text);
  if (tokens.length === 0) return { suggestion: null };

  let model;
  try {
    model = await _trainForUser(userId);
  } catch (err) {
    logger.warn('categorize.train failed', { message: err.message });
    return { suggestion: null };
  }

  const result = _scoreNaiveBayes(tokens, model);
  if (!result || result.confidence < MIN_CONFIDENCE) {
    return { suggestion: null, reason: 'low_confidence', sampleSize: model.totalDocs };
  }

  // Verify the suggested category still exists and is accessible.
  // (User might have soft-deleted it since their last expense.)
  const category = await Category.findOne({
    _id: result.categoryId,
    deletedAt: null,
    isActive: true,
    $or: [{ user: oid(userId) }, { user: null, isDefault: true }],
  })
    .select('_id name icon color')
    .lean();
  if (!category) return { suggestion: null };

  return {
    suggestion: {
      categoryId: String(category._id),
      name: category.name,
      icon: category.icon,
      color: category.color,
      confidence: Math.round(result.confidence * 100) / 100,
    },
    sampleSize: model.totalDocs,
  };
};

module.exports = {
  suggest,
  // Exposed for tests:
  _tokenize,
  _trainForUser,
  _scoreNaiveBayes,
  MIN_CONFIDENCE,
};
