const Joi = require('joi');
const { objectId } = require('./common.validator');
const { PAYMENT_METHODS, CURRENCIES, RECURRING_FREQUENCIES } = require('../config/constants');

const baseFields = {
  title: Joi.string().trim().min(1).max(80),
  amount: Joi.number().positive().precision(2),
  currency: Joi.string().valid(...CURRENCIES),
  category: objectId,
  paymentMethod: Joi.string().valid(...PAYMENT_METHODS),
  note: Joi.string().trim().max(500).allow(''),
  frequency: Joi.string().valid(...RECURRING_FREQUENCIES),
  interval: Joi.number().integer().min(1).max(60),
  dayOfMonth: Joi.number().integer().min(1).max(31),
  weekday: Joi.number().integer().min(0).max(6),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null),
  maxOccurrences: Joi.number().integer().min(1).allow(null),
};

const create = {
  body: Joi.object({
    ...baseFields,
    title: baseFields.title.required(),
    amount: baseFields.amount.required(),
    category: baseFields.category.required(),
    frequency: baseFields.frequency.required(),
    interval: baseFields.interval.default(1),
    paymentMethod: baseFields.paymentMethod.default('cash'),
    startDate: baseFields.startDate.required(),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    ...baseFields,
    isActive: Joi.boolean(),
  }).min(1),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

const list = {
  query: Joi.object({
    activeOnly: Joi.boolean().default(true),
  }),
};

module.exports = { create, update, byId, list };
