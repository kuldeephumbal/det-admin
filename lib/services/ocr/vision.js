// Google Cloud Vision OCR adapter.
//
// Uses `@google-cloud/vision`'s `textDetection`. We then run a thin
// regex pass to pull merchant / total / date out of the OCRed text —
// most receipts have a recognizable "TOTAL ..." line and a top-of-image
// merchant header. Confidence is averaged across detected blocks.
//
// Until the SDK and credentials land, `extract()` throws OCR_NOT_CONFIGURED.

const env = require('../../config/env');

let _client = null;
const _getClient = () => {
  if (_client) return _client;
  if (!isConfigured()) {
    const err = new Error('Google Vision not configured');
    err.statusCode = 503;
    err.code = 'OCR_NOT_CONFIGURED';
    throw err;
  }
  // eslint-disable-next-line global-require
  const { ImageAnnotatorClient } = require('@google-cloud/vision');
  const credentials = JSON.parse(
    Buffer.from(env.GOOGLE_VISION_CREDENTIALS_JSON, 'base64').toString('utf8')
  );
  _client = new ImageAnnotatorClient({ credentials });
  return _client;
};

const isConfigured = () => Boolean(env.GOOGLE_VISION_CREDENTIALS_JSON);

// Heuristics good enough for v1. Replace with a more robust parser
// (e.g., line-item extraction via spatial layout) when accuracy
// becomes a release blocker — plan §16 gates release on ≥85% on a
// 100-receipt eval set.
const _parseText = (fullText) => {
  const lines = fullText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Merchant: first non-empty line, cleaned of trailing punctuation.
  const merchant = (lines[0] || '').replace(/[*•·.,;:]+$/g, '').slice(0, 80);

  // Total: last "TOTAL ..." line with a number; fall back to the
  // largest numeric value in the text (receipts almost always have
  // total > any line item).
  let total = 0;
  const totalLine = [...lines].reverse().find((l) => /total/i.test(l) && /\d/.test(l));
  if (totalLine) {
    const m = totalLine.match(/[\d.,]+/g);
    if (m) total = parseFloat(m[m.length - 1].replace(/,/g, ''));
  } else {
    const numbers = (fullText.match(/[\d]+\.\d{2}/g) || []).map((n) => parseFloat(n));
    if (numbers.length) total = Math.max(...numbers);
  }

  // Date: ISO or dd/mm/yyyy. Apply local heuristics for IN-format receipts.
  let date = null;
  const dateMatch =
    fullText.match(/\b(\d{4}-\d{2}-\d{2})\b/) ||
    fullText.match(/\b(\d{2}[/\-.]\d{2}[/\-.]\d{2,4})\b/);
  if (dateMatch) {
    const d = new Date(dateMatch[1]);
    if (!Number.isNaN(d.getTime())) date = d;
  }

  return {
    merchant,
    total: Number.isFinite(total) ? total : 0,
    date,
    lineItems: [], // populated by a stronger parser in v2
  };
};

const extract = async ({ buffer }) => {
  const client = _getClient();
  const [result] = await client.textDetection({ image: { content: buffer } });
  const annotations = result.textAnnotations || [];
  if (annotations.length === 0) {
    return { merchant: '', total: 0, currency: '', date: null, lineItems: [], confidence: 0, raw: null };
  }

  const fullText = annotations[0].description || '';
  const parsed = _parseText(fullText);

  // Average confidence across word-level blocks for a single signal.
  const blocks = result.fullTextAnnotation?.pages?.[0]?.blocks || [];
  const confidences = blocks.flatMap((b) =>
    b.paragraphs.flatMap((p) => p.words.map((w) => w.confidence))
  );
  const confidence = confidences.length
    ? confidences.reduce((s, x) => s + x, 0) / confidences.length
    : 0;

  return {
    ...parsed,
    currency: '', // Vision doesn't return currency; left for user override.
    confidence,
    raw: { fullText, blockCount: blocks.length },
  };
};

module.exports = { isConfigured, extract };
