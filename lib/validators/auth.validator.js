const Joi = require('joi');
const { email, password } = require('./common.validator');

const register = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    email: email.required(),
    phone: Joi.string()
      .trim()
      .pattern(/^\+?[0-9\s-]{7,20}$/)
      .messages({ 'string.pattern.base': 'Invalid phone number' }),
    password: password.required(),
    currency: Joi.string().length(3).uppercase(),
    timezone: Joi.string().max(60),
  }),
};

const login = {
  body: Joi.object({
    email: email.required(),
    password: Joi.string().required(),
  }),
};

const refresh = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

const logout = {
  body: Joi.object({
    refreshToken: Joi.string().required(),
  }),
};

const forgotPassword = {
  body: Joi.object({
    email: email.required(),
  }),
};

const resetPassword = {
  body: Joi.object({
    token: Joi.string().required(),
    password: password.required(),
  }),
};

const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: password.required().disallow(Joi.ref('currentPassword')).messages({
      'any.invalid': 'New password must be different from current password',
    }),
  }),
};

const sendVerification = {
  body: Joi.object({}),
};

const verifyEmail = {
  body: Joi.object({
    token: Joi.string().hex().length(64).required(),
  }),
};

const googleSignIn = {
  body: Joi.object({
    // Google id_token is a JWS that's typically ~1.3KB — cap loose.
    idToken: Joi.string().min(20).max(4096).required(),
  }),
};

const requestOtp = {
  body: Joi.object({
    email: email.required(),
    // Optional — used as the default name when we lazy-create a user
    // on first sign-in. Falls back to the email's local-part otherwise.
    name: Joi.string().trim().min(2).max(80),
  }),
};

const verifyOtp = {
  body: Joi.object({
    email: email.required(),
    code: Joi.string()
      .trim()
      .pattern(/^[0-9]{6}$/)
      .required()
      .messages({ 'string.pattern.base': 'Enter the 6-digit code' }),
  }),
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  sendVerification,
  verifyEmail,
  googleSignIn,
  requestOtp,
  verifyOtp,
};
