const Joi = require('joi');
const { objectId, email } = require('./common.validator');
const { CURRENCIES, SPLIT_METHODS, GROUP_ROLES } = require('../config/constants');

// ---- Groups ----------------------------------------------------------

const createGroup = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(80).required(),
    description: Joi.string().trim().max(300).allow('').default(''),
    currency: Joi.string().valid(...CURRENCIES).default('INR'),
  }),
};

const updateGroup = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(80),
    description: Joi.string().trim().max(300).allow(''),
    currency: Joi.string().valid(...CURRENCIES),
    simplifyDebts: Joi.boolean(),
  }).min(1),
};

const groupParam = {
  params: Joi.object({ id: objectId.required() }),
};

const listGroups = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }).unknown(true),
};

// ---- Members / invites ----------------------------------------------

const inviteMember = {
  params: Joi.object({ id: objectId.required() }),
  // Either a phone (contact invite, may trigger SMS) or an email
  // (existing email-invite path). At least one is required.
  body: Joi.object({
    phone: Joi.string().trim().max(30),
    email: email,
    displayName: Joi.string().trim().max(80).allow(''),
    role: Joi.string().valid(...GROUP_ROLES).default('member'),
  }).or('phone', 'email'),
};

const memberParam = {
  params: Joi.object({
    id: objectId.required(),
    memberId: objectId.required(),
  }),
};

const redeemInvite = {
  params: Joi.object({ token: Joi.string().hex().length(64).required() }),
};

const matchContacts = {
  body: Joi.object({
    phones: Joi.array().items(Joi.string().trim().max(30)).min(1).max(2000).required(),
  }),
};

// ---- Expenses --------------------------------------------------------

// `participants` is used for an equal split; `splits` ([{user,value}])
// carries the per-member weighting for exact/percentage/shares. The
// service does the method-specific math + sum validation.
const _expenseBase = {
  description: Joi.string().trim().min(1).max(140).required(),
  amount: Joi.number().positive().precision(2).required(),
  currency: Joi.string().valid(...CURRENCIES),
  paidBy: objectId.required(),
  splitMethod: Joi.string().valid(...SPLIT_METHODS).default('equal'),
  participants: Joi.array().items(objectId).min(1),
  splits: Joi.array()
    .items(Joi.object({ user: objectId.required(), value: Joi.number().min(0).required() }))
    .min(1),
  category: objectId.allow(null),
  date: Joi.date().iso(),
  note: Joi.string().trim().max(500).allow('').default(''),
};

const createExpense = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object(_expenseBase).when(Joi.object({ splitMethod: Joi.valid('equal') }).unknown(), {
    then: Joi.object({ participants: Joi.array().items(objectId).min(1).required() }),
    otherwise: Joi.object({
      splits: Joi.array()
        .items(Joi.object({ user: objectId.required(), value: Joi.number().min(0).required() }))
        .min(1)
        .required(),
    }),
  }),
};

const updateExpense = {
  params: Joi.object({ id: objectId.required(), expenseId: objectId.required() }),
  body: Joi.object({
    description: Joi.string().trim().min(1).max(140),
    amount: Joi.number().positive().precision(2),
    currency: Joi.string().valid(...CURRENCIES),
    paidBy: objectId,
    splitMethod: Joi.string().valid(...SPLIT_METHODS),
    participants: Joi.array().items(objectId).min(1),
    splits: Joi.array()
      .items(Joi.object({ user: objectId.required(), value: Joi.number().min(0).required() }))
      .min(1),
    category: objectId.allow(null),
    date: Joi.date().iso(),
    note: Joi.string().trim().max(500).allow(''),
  }).min(1),
};

const expenseParam = {
  params: Joi.object({ id: objectId.required(), expenseId: objectId.required() }),
};

const listExpenses = {
  params: Joi.object({ id: objectId.required() }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }).unknown(true),
};

// ---- Settlements -----------------------------------------------------

const createSettlement = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    from: objectId.required(),
    to: objectId.required(),
    amount: Joi.number().positive().precision(2).required(),
    currency: Joi.string().valid(...CURRENCIES),
    note: Joi.string().trim().max(300).allow('').default(''),
  }),
};

const settlementParam = {
  params: Joi.object({ id: objectId.required(), settlementId: objectId.required() }),
};

module.exports = {
  createGroup,
  updateGroup,
  groupParam,
  listGroups,
  inviteMember,
  memberParam,
  redeemInvite,
  matchContacts,
  createExpense,
  updateExpense,
  expenseParam,
  listExpenses,
  createSettlement,
  settlementParam,
};
