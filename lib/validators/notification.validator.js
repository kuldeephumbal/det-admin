const Joi = require('joi');
const { objectId } = require('./common.validator');
const { NOTIFICATION_TYPES } = require('../config/constants');

const list = {
  query: Joi.object({
    unreadOnly: Joi.boolean().default(false),
    type: Joi.string().valid(...Object.values(NOTIFICATION_TYPES)),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  }),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

module.exports = { list, byId };
