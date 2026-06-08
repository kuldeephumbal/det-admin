const Joi = require('joi');
const { objectId } = require('./common.validator');
const { CURRENCIES, BILL_RECURRENCES } = require('../config/constants');

const createBill = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(80).required(),
    amount: Joi.number().positive().precision(2).required(),
    currency: Joi.string().valid(...CURRENCIES).default('INR'),
    account: objectId.allow(null),
    category: objectId.allow(null),
    dueDate: Joi.date().iso().required(),
    recurrence: Joi.string().valid(...BILL_RECURRENCES).default('none'),
    autoPay: Joi.boolean().default(false),
    notes: Joi.string().trim().max(500).allow('').default(''),
  }),
};

const updateBill = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(80),
    amount: Joi.number().positive().precision(2),
    currency: Joi.string().valid(...CURRENCIES),
    account: objectId.allow(null),
    category: objectId.allow(null),
    dueDate: Joi.date().iso(),
    recurrence: Joi.string().valid(...BILL_RECURRENCES),
    autoPay: Joi.boolean(),
    notes: Joi.string().trim().max(500).allow(''),
  }).min(1),
};

const billParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listBills = {
  query: Joi.object({
    state: Joi.string().valid('upcoming', 'overdue', 'paid', 'all').default('all'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    daysAhead: Joi.number().integer().min(1).max(365),
  }).unknown(true),
};

const payBill = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    // Actual amount paid — may differ from the expected bill amount
    // (utility was higher than usual, etc). Falls back to bill.amount.
    amount: Joi.number().positive().precision(2),
    account: objectId,
    category: objectId,
    paidAt: Joi.date().iso().default(() => new Date()),
    note: Joi.string().trim().max(500).allow('').default(''),
  }).default({}),
};

module.exports = { createBill, updateBill, billParam, listBills, payBill };
