const Joi = require('joi');
const { CURRENCIES } = require('../config/constants');

const updateMe = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80),
    phone: Joi.string()
      .trim()
      .pattern(/^\+?[0-9\s-]{7,20}$/)
      .allow(''),
    avatarUrl: Joi.string().uri().allow(''),
    preferences: Joi.object({
      currency: Joi.string().valid(...CURRENCIES),
      locale: Joi.string().max(20),
      timezone: Joi.string().max(60),
      themeMode: Joi.string().valid('system', 'light', 'dark'),
      notifications: Joi.object({
        budgetAlerts: Joi.boolean(),
        monthlySummary: Joi.boolean(),
        expenseReminders: Joi.boolean(),
        recurringReminders: Joi.boolean(),
      }),
    }),
  }).min(1),
};

module.exports = { updateMe };
