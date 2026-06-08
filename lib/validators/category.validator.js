const Joi = require('joi');
const { objectId } = require('./common.validator');

const hexColor = Joi.string()
  .pattern(/^#([0-9a-fA-F]{3}){1,2}$/)
  .message('Color must be a hex code like #FF7043');

const name = Joi.string().trim().min(1).max(40);
const icon = Joi.string().trim().min(1).max(40);

const list = {
  query: Joi.object({
    includeInactive: Joi.boolean().default(false),
  }),
};

const create = {
  body: Joi.object({
    name: name.required(),
    icon: icon.default('category'),
    color: hexColor.default('#78909C'),
    sortOrder: Joi.number().integer().min(0),
  }),
};

const update = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name,
    icon,
    color: hexColor,
    sortOrder: Joi.number().integer().min(0),
    isActive: Joi.boolean(),
  }).min(1),
};

const byId = {
  params: Joi.object({ id: objectId.required() }),
};

const remove = {
  params: Joi.object({ id: objectId.required() }),
  query: Joi.object({
    force: Joi.boolean().default(false),
  }),
};

module.exports = { list, create, update, byId, remove };
