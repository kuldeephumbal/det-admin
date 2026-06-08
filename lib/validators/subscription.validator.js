const Joi = require('joi');
const { objectId } = require('./common.validator');
const { BILLING_PROVIDERS, SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUS } = require('../config/constants');

// Provider receipt verification. The `receipt` field is intentionally
// loose (string) because each provider hands us a different shape:
//   - Apple: base64 receipt blob
//   - Google: purchase token
//   - Stripe: payment_intent / setup_intent / subscription id (test mode)
// Provider-specific shape is enforced inside the adapter, not here.
const verifyPurchase = {
  body: Joi.object({
    provider: Joi.string()
      .valid(...Object.values(BILLING_PROVIDERS).filter((p) => p !== 'manual'))
      .required(),
    receipt: Joi.string().trim().min(1).max(8192).required(),
    productId: Joi.string().trim().min(1).max(120).required(),
    // Optional client metadata — purely informational on the server side.
    platform: Joi.string().valid('android', 'ios', 'web').optional(),
  }),
};

const cancel = {
  body: Joi.object({
    reason: Joi.string().trim().max(200).allow('').default(''),
  }).default({}),
};

const adminUpdate = {
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    // "Comp premium" — extends currentPeriodEnd. Mutually exclusive with status.
    extendByDays: Joi.number().integer().min(1).max(3650).optional(),
    status: Joi.string().valid(...Object.values(SUBSCRIPTION_STATUS)).optional(),
    plan: Joi.string().valid(...Object.values(SUBSCRIPTION_PLANS)).optional(),
    note: Joi.string().trim().max(200).allow('').optional(),
  })
    .or('extendByDays', 'status', 'plan')
    .messages({
      'object.missing': 'Provide at least one of extendByDays, status, plan',
    }),
};

module.exports = { verifyPurchase, cancel, adminUpdate };
