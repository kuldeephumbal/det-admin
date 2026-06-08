// OCR provider router.
//
// Available adapters:
//   - vision   (Google Cloud Vision — recommended for v1, per plan §17)
//   - textract (AWS Textract — alternative)
//   - paddle   (PaddleOCR self-hosted — fallback / cost-cutter)
//
// Each adapter implements:
//   isConfigured() → bool
//   extract({ buffer, contentType }) → {
//     merchant, total, currency, date, lineItems[], confidence, raw
//   }
//
// Provider is env-driven (`OCR_PROVIDER`). All adapters throw a clear
// error when called without credentials — OCR is a money path and must
// not silently no-op.

const env = require('../../config/env');
const vision = require('./vision');

const ADAPTERS = { vision };

const get = () => {
  const name = env.OCR_PROVIDER || 'vision';
  const adapter = ADAPTERS[name];
  if (!adapter) throw new Error(`Unknown OCR_PROVIDER: ${name}`);
  return adapter;
};

module.exports = { get };
