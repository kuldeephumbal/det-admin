const Joi = require('joi');
const { objectId } = require('./common.validator');

// Constraints chosen to bound payload size — FCM tokens are typically
// 140-180 chars but spec doesn't pin a max, so allow up to 4096.
const registerDevice = {
  body: Joi.object({
    fcmToken: Joi.string().trim().min(20).max(4096).required(),
    platform: Joi.string().valid('android', 'ios', 'web').required(),
    model: Joi.string().trim().max(80).allow('').default(''),
    osVersion: Joi.string().trim().max(40).allow('').default(''),
    appVersion: Joi.string().trim().max(20).allow('').default(''),
    locale: Joi.string().trim().max(20).allow('').default(''),
  }),
};

const listDevices = {
  query: Joi.object({
    // Optional hint from the client about which row is "this device" so
    // the list can render a badge. Untrusted — the server only uses it
    // to mark the row, never to gate access.
    currentDeviceId: objectId,
  }).unknown(true),
};

const deviceParam = {
  params: Joi.object({
    id: objectId.required(),
  }),
};

module.exports = { registerDevice, listDevices, deviceParam };
