const Joi = require('joi');
const { objectId, email } = require('./common.validator');

const inviteByEmail = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    email: email.required(),
    role: Joi.string().valid('member').default('member'),
  }),
};

const membershipParam = {
  params: Joi.object({
    id: objectId.required(),
    membershipId: objectId.required(),
  }),
};

const pendingMembershipParam = {
  params: Joi.object({ id: objectId.required() }),
};

module.exports = {
  inviteByEmail,
  membershipParam,
  pendingMembershipParam,
};
