const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });

const signRefreshToken = (payload, jti) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    jwtid: jti,
  });

const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

const newJti = () => crypto.randomUUID();

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const issueTokensFor = (user) => {
  const payload = { sub: String(user._id), role: user.role };
  const jti = newJti();
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload, jti),
    jti,
  };
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokensFor,
  newJti,
  hashToken,
};
