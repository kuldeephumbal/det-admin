const Joi = require('joi');
const { objectId } = require('./common.validator');

// Multipart payloads bypass JSON validation. The `withRoute` schema
// is applied to the route's query / params; body validation for the
// uploaded file happens inside receipt.service.create via direct
// content-type + size checks against the parsed form data.
const receiptParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listReceipts = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    status: Joi.string().valid('pending', 'processing', 'completed', 'failed'),
  }).unknown(true),
};

// Hard limits for inbound files. Joi can't see the request body itself
// for multipart, but exporting these constants lets the service
// enforce them and the route validate the Content-Length header up-front.
const MAX_RECEIPT_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_RECEIPT_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

module.exports = {
  receiptParam,
  listReceipts,
  MAX_RECEIPT_SIZE_BYTES,
  ALLOWED_RECEIPT_MIME,
};
