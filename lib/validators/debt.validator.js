const Joi = require('joi');
const { objectId } = require('./common.validator');
const { CURRENCIES, DEBT_TYPES } = require('../config/constants');

const createDebt = {
  body: Joi.object({
    type: Joi.string().valid(...DEBT_TYPES).required(),
    counterparty: Joi.string().trim().min(1).max(80).required(),
    amount: Joi.number().positive().precision(2).required(),
    currency: Joi.string().valid(...CURRENCIES).default('INR'),
    account: objectId.allow(null),
    dueDate: Joi.date().iso().allow(null),
    note: Joi.string().trim().max(500).allow('').default(''),
  }),
};

const updateDebt = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    counterparty: Joi.string().trim().min(1).max(80),
    // Original amount can be corrected before any repayment is recorded.
    amount: Joi.number().positive().precision(2),
    currency: Joi.string().valid(...CURRENCIES),
    account: objectId.allow(null),
    dueDate: Joi.date().iso().allow(null),
    note: Joi.string().trim().max(500).allow(''),
  }).min(1),
};

const debtParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listDebts = {
  query: Joi.object({
    status: Joi.string().valid('outstanding', 'settled', 'all').default('all'),
    type: Joi.string().valid(...DEBT_TYPES),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }).unknown(true),
};

const recordRepayment = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    amount: Joi.number().positive().precision(2).required(),
    account: objectId,
    category: objectId,
    occurredAt: Joi.date().iso().default(() => new Date()),
    note: Joi.string().trim().max(200).allow('').default(''),
  }),
};

const listRepayments = {
  params: Joi.object({ id: objectId.required() }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }).unknown(true),
};

module.exports = {
  createDebt,
  updateDebt,
  debtParam,
  listDebts,
  recordRepayment,
  listRepayments,
};
