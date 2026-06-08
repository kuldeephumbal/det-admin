const Joi = require('joi');
const { objectId } = require('./common.validator');
const { USER_STATUS, NOTIFICATION_TYPES } = require('../config/constants');

const listUsers = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    q: Joi.string().trim().max(80),
    status: Joi.string().valid(...Object.values(USER_STATUS)),
    role: Joi.string().valid('user', 'admin'),
    plan: Joi.string().valid('free', 'premium'),
  }),
};

const userById = {
  params: Joi.object({ id: objectId.required() }),
};

const updateUserStatus = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    status: Joi.string().valid(...Object.values(USER_STATUS)).required(),
  }),
};

const createDefaultCategory = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(40).required(),
    icon: Joi.string().trim().max(40).default('category'),
    color: Joi.string().pattern(/^#([0-9a-fA-F]{3}){1,2}$/).default('#78909C'),
    sortOrder: Joi.number().integer().min(0).default(0),
  }),
};

const updateDefaultCategory = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(40),
    icon: Joi.string().trim().max(40),
    color: Joi.string().pattern(/^#([0-9a-fA-F]{3}){1,2}$/),
    sortOrder: Joi.number().integer().min(0),
    isActive: Joi.boolean(),
  }).min(1),
};

const broadcast = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(120).required(),
    body: Joi.string().trim().max(1000).allow(''),
    type: Joi.string()
      .valid(...Object.values(NOTIFICATION_TYPES))
      .default(NOTIFICATION_TYPES.ANNOUNCEMENT),
    expiresInDays: Joi.number().integer().min(1).max(90),
  }),
};

const listSubscriptions = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    plan: Joi.string().valid('free', 'premium'),
    status: Joi.string().valid('active', 'cancelled', 'expired', 'trialing'),
  }),
};

module.exports = {
  listUsers,
  userById,
  updateUserStatus,
  createDefaultCategory,
  updateDefaultCategory,
  broadcast,
  listSubscriptions,
};
