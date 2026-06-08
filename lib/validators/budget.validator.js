const Joi = require('joi');
const { objectId } = require('./common.validator');
const { CURRENCIES } = require('../config/constants');

// monthKey is YYYYMM — easy server-side equality lookup, easy client-side bookkeeping.
const monthKey = Joi.number().integer().min(190001).max(999912);

const create = {
  body: Joi.object({
    category: objectId.allow(null),
    period: Joi.string().valid('monthly', 'yearly').default('monthly'),
    year: Joi.number().integer().min(1900).max(9999).required(),
    month: Joi.when('period', {
      is: 'monthly',
      then: monthKey.required(),
      otherwise: Joi.forbidden(),
    }),
    amount: Joi.number().positive().precision(2).required(),
    currency: Joi.string().valid(...CURRENCIES),
    alertThreshold: Joi.number().integer().min(0).max(100).default(80),
    rolloverUnused: Joi.boolean().default(false),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    amount: Joi.number().positive().precision(2),
    alertThreshold: Joi.number().integer().min(0).max(100),
    rolloverUnused: Joi.boolean(),
    isActive: Joi.boolean(),
  }).min(1),
};

const list = {
  query: Joi.object({
    period: Joi.string().valid('monthly', 'yearly'),
    year: Joi.number().integer().min(1900).max(9999),
    month: monthKey,
    activeOnly: Joi.boolean().default(true),
  }),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

const status = {
  query: Joi.object({
    month: monthKey, // defaults to current month server-side
    year: Joi.number().integer().min(1900).max(9999),
  }),
};

const suggestion = {
  query: Joi.object({
    category: objectId.allow(null),
    period: Joi.string().valid('monthly', 'yearly').default('monthly'),
  }).unknown(true),
};

module.exports = { create, update, list, byId, status, suggestion };
