const Joi = require('joi');
const { objectId } = require('./common.validator');
const { CURRENCIES, RECURRING_FREQUENCIES } = require('../config/constants');

const contributionRule = Joi.object({
  frequency: Joi.string().valid(...RECURRING_FREQUENCIES).required(),
  interval: Joi.number().integer().min(1).max(365).default(1),
  amount: Joi.number().positive().required(),
  dayOfMonth: Joi.number().integer().min(1).max(31).allow(null).default(null),
  weekday: Joi.number().integer().min(0).max(6).allow(null).default(null),
  // nextRunAt is computed server-side, never trusted from the client.
}).optional();

const createGoal = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(80).required(),
    icon: Joi.string().trim().max(40).default('savings'),
    color: Joi.string().trim().max(20).default('#26A69A'),
    targetAmount: Joi.number().positive().required(),
    currency: Joi.string().valid(...CURRENCIES).default('INR'),
    deadline: Joi.date().iso().required(),
    contributionRule,
  }),
};

const updateGoal = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(80),
    icon: Joi.string().trim().max(40),
    color: Joi.string().trim().max(20),
    targetAmount: Joi.number().positive(),
    deadline: Joi.date().iso(),
    contributionRule: contributionRule.allow(null),
    status: Joi.string().valid('active', 'completed', 'abandoned'),
  }).min(1),
};

const goalParam = {
  params: Joi.object({ id: objectId.required() }),
};

const contribute = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    amount: Joi.number().not(0).required(), // signed; 0 is nonsense
    occurredAt: Joi.date().iso().default(() => new Date()),
    note: Joi.string().trim().max(200).allow('').default(''),
  }),
};

const listContributions = {
  params: Joi.object({ id: objectId.required() }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }).unknown(true),
};

module.exports = { createGoal, updateGoal, goalParam, contribute, listContributions };
