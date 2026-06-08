const Joi = require('joi');
const { objectId } = require('./common.validator');
const { INSIGHT_TYPES } = require('../models/Insight');

const listInsights = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    unreadOnly: Joi.boolean(),
    type: Joi.string().valid(...INSIGHT_TYPES),
  }).unknown(true),
};

const insightParam = {
  params: Joi.object({ id: objectId.required() }),
};

const regenerate = {
  body: Joi.object({
    period: Joi.string().valid('week', 'month').default('week'),
  }).default({}),
};

module.exports = { listInsights, insightParam, regenerate };
