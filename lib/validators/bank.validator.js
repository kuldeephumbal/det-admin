const Joi = require('joi');
const { objectId } = require('./common.validator');
const { BANK_PROVIDERS } = require('../models/BankConnection');

const initConnect = {
  body: Joi.object({
    provider: Joi.string().valid(...BANK_PROVIDERS).optional(),
  }).default({}),
};

const exchangeConnect = {
  body: Joi.object({
    provider: Joi.string().valid(...BANK_PROVIDERS).optional(),
    publicToken: Joi.string().trim().min(1).max(2048).required(),
  }),
};

const connectionParam = {
  params: Joi.object({ id: objectId.required() }),
};

const triggerSync = {
  body: Joi.object({
    connectionId: objectId.optional(),
  }).default({}),
};

module.exports = { initConnect, exchangeConnect, connectionParam, triggerSync };
