const Joi = require('joi');
const { objectId } = require('./common.validator');
const { CURRENCIES } = require('../config/constants');

// Regex-shape validator — rejects obvious ReDoS triggers and caps
// length. We can't fully test for catastrophic backtracking without
// running the regex, but we can reject the common offenders:
//   - nested unbounded quantifiers like `(a+)+`, `(a*)*`
//   - very long patterns
//   - patterns with too many alternations
const _safeRegex = (max = 200) =>
  Joi.string()
    .trim()
    .max(max)
    .custom((value, helpers) => {
      if (/\(.+[+*]\)[+*]/.test(value)) {
        return helpers.error('any.invalid', { message: 'nested quantifiers banned' });
      }
      if ((value.match(/\|/g) || []).length > 20) {
        return helpers.error('any.invalid', { message: 'too many alternations' });
      }
      // Force-compile once so a totally malformed regex fails fast.
      try {
        new RegExp(value);
      } catch (_) {
        return helpers.error('any.invalid', { message: 'invalid regex syntax' });
      }
      return value;
    }, 'safe-regex');

const createRule = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(80).required(),
    bankName: Joi.string().trim().max(40).allow('').default(''),
    senderPattern: _safeRegex(200).required(),
    amountRegex: _safeRegex(200).required(),
    merchantRegex: _safeRegex(200).allow('').default(''),
    datePattern: Joi.string().trim().max(80).allow('').default(''),
    currency: Joi.string().valid(...CURRENCIES).default('INR'),
    version: Joi.number().integer().min(1).default(1),
    isActive: Joi.boolean().default(true),
    notes: Joi.string().trim().max(500).allow('').default(''),
  }),
};

const updateRule = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(80),
    bankName: Joi.string().trim().max(40).allow(''),
    senderPattern: _safeRegex(200),
    amountRegex: _safeRegex(200),
    merchantRegex: _safeRegex(200).allow(''),
    datePattern: Joi.string().trim().max(80).allow(''),
    currency: Joi.string().valid(...CURRENCIES),
    version: Joi.number().integer().min(1),
    isActive: Joi.boolean(),
    notes: Joi.string().trim().max(500).allow(''),
  }).min(1),
};

const ruleParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listRules = {
  query: Joi.object({
    activeOnly: Joi.boolean().default(true),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
    bankName: Joi.string().trim().max(40),
  }).unknown(true),
};

module.exports = { createRule, updateRule, ruleParam, listRules };
