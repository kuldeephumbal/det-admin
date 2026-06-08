const Joi = require('joi');

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('"{#label}" must be a valid id');

const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[a-z]/, 'lowercase')
  .pattern(/[A-Z]/, 'uppercase')
  .pattern(/[0-9]/, 'digit')
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.name': 'Password must contain at least one {#name} character',
  });

const email = Joi.string().email({ minDomainSegments: 2 }).lowercase().trim().max(254);

module.exports = { objectId, password, email };
