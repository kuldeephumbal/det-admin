const Joi = require('joi');
const { objectId } = require('./common.validator');
const { PAYMENT_METHODS, CURRENCIES } = require('../config/constants');

const tags = Joi.array().items(Joi.string().trim().lowercase().max(30)).max(20);

const create = {
  body: Joi.object({
    amount: Joi.number().positive().precision(2).required(),
    currency: Joi.string().valid(...CURRENCIES),
    category: objectId.required(),
    // account is optional during the Feature 13 rollout — the service
    // falls back to the user's default Cash account when omitted.
    // After mobile picker UX is universal, flip to .required().
    account: objectId,
    date: Joi.date().iso().max('now').default(() => new Date()),
    note: Joi.string().trim().max(500).allow(''),
    paymentMethod: Joi.string().valid(...PAYMENT_METHODS).default('cash'),
    tags,
    attachmentUrl: Joi.string().uri().allow(''),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    amount: Joi.number().positive().precision(2),
    currency: Joi.string().valid(...CURRENCIES),
    category: objectId,
    account: objectId,
    date: Joi.date().iso().max('now'),
    note: Joi.string().trim().max(500).allow(''),
    paymentMethod: Joi.string().valid(...PAYMENT_METHODS),
    tags,
    attachmentUrl: Joi.string().uri().allow(''),
  }).min(1),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

const list = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().pattern(/^[-+]?(date|amount|createdAt)(,[-+]?(date|amount|createdAt))*$/),
    from: Joi.date().iso(),
    to: Joi.date().iso().min(Joi.ref('from')),
    category: objectId,
    paymentMethod: Joi.string().valid(...PAYMENT_METHODS),
    minAmount: Joi.number().min(0),
    maxAmount: Joi.number().min(Joi.ref('minAmount')),
    search: Joi.string().trim().min(1).max(100),
    tag: Joi.string().trim().lowercase().max(30),
  }),
};

// Auto-categorise endpoint payload — note + optional merchant. Amount
// is accepted for future hints (a big-ticket transaction is more
// likely to be Travel than Food) but currently ignored by the
// Naive Bayes path.
const categorize = {
  body: Joi.object({
    note: Joi.string().trim().min(1).max(500).required(),
    merchant: Joi.string().trim().max(120).allow(''),
    amount: Joi.number().positive().precision(2),
  }),
};

module.exports = { create, update, byId, list, categorize };
