const Joi = require('joi');
const { objectId } = require('./common.validator');
const { CURRENCIES, ACCOUNT_TYPES } = require('../config/constants');

const accountTypes = Object.values(ACCOUNT_TYPES);

const createAccount = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(60).required(),
    type: Joi.string().valid(...accountTypes).required(),
    icon: Joi.string().trim().max(40).default('wallet'),
    color: Joi.string().trim().max(20).default('#5B7CFA'),
    currency: Joi.string().valid(...CURRENCIES).default('INR'),
    openingBalance: Joi.number().precision(2).default(0),
    accountMask: Joi.string().trim().allow('').pattern(/^\d{0,4}$/).default(''),
    excludeFromTotals: Joi.boolean().default(false),
    sortOrder: Joi.number().integer().default(0),
  }),
};

const updateAccount = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(60),
    type: Joi.string().valid(...accountTypes),
    icon: Joi.string().trim().max(40),
    color: Joi.string().trim().max(20),
    currency: Joi.string().valid(...CURRENCIES),
    accountMask: Joi.string().trim().allow('').pattern(/^\d{0,4}$/),
    excludeFromTotals: Joi.boolean(),
    isArchived: Joi.boolean(),
    sortOrder: Joi.number().integer(),
    // openingBalance changes are NOT allowed via update — too easy to
    // break the running balance. If the user genuinely needs to adjust,
    // they should add a one-off transaction.
  }).min(1),
};

const accountParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listAccounts = {
  query: Joi.object({
    includeArchived: Joi.boolean().default(false),
  }).unknown(true),
};

const transfer = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    toAccount: objectId.required(),
    amount: Joi.number().positive().precision(2).required(),
    occurredAt: Joi.date().iso().default(() => new Date()),
    note: Joi.string().trim().max(200).allow('').default(''),
  }),
};

module.exports = {
  createAccount,
  updateAccount,
  accountParam,
  listAccounts,
  transfer,
};
