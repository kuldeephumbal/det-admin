const crypto = require('crypto');
const env = require('../config/env');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const Subscription = require('../models/Subscription');
const ApiError = require('../utils/ApiError');
const parseMs = require('../utils/ms');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  newJti,
  hashToken,
} = require('../utils/jwt');
const { USER_STATUS, SUBSCRIPTION_PLANS } = require('../config/constants');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../utils/mailer');
const logger = require('../utils/logger');

const sha256 = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const buildAccess = (user) =>
  signAccessToken({ sub: String(user._id), role: user.role });

const issueRefreshToken = async (user, { userAgent = '', ip = '' } = {}) => {
  const jti = newJti();
  const token = signRefreshToken({ sub: String(user._id), role: user.role }, jti);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + parseMs(env.JWT_REFRESH_EXPIRES_IN));
  await RefreshToken.create({ user: user._id, jti, tokenHash, userAgent, ip, expiresAt });
  return token;
};

const issueTokenPair = async (user, ctx) => {
  const accessToken = buildAccess(user);
  const refreshToken = await issueRefreshToken(user, ctx);
  return { accessToken, refreshToken };
};

const sanitize = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  role: user.role,
  plan: user.plan,
  preferences: user.preferences,
  emailVerifiedAt: user.emailVerifiedAt || null,
  createdAt: user.createdAt,
});

// Issue a fresh verification token, persist its hash + expiry, and
// dispatch the email. Returns the raw token for tests / dev; never
// throws on mail-send failure (the token is stored either way).
const _issueVerificationToken = async (user, { baseUrl } = {}) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + parseMs(env.EMAIL_VERIFICATION_TOKEN_TTL));

  user.emailVerificationToken = sha256(rawToken);
  user.emailVerificationExpires = expiresAt;
  user.emailVerificationSentAt = new Date();
  await user.save({ validateBeforeSave: false });

  const expiresInHours = Math.max(
    1,
    Math.round(parseMs(env.EMAIL_VERIFICATION_TOKEN_TTL) / 3_600_000)
  );
  const verifyUrl = `${baseUrl || env.APP_URL}/verify-email?token=${rawToken}`;

  try {
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl,
      expiresInHours,
    });
  } catch (err) {
    logger.error('Failed to send verification email', { message: err.message });
  }

  return rawToken;
};

const register = async ({ name, email, phone, password, currency, timezone }, ctx = {}) => {
  const existing = await User.findOne({ email }).select('_id');
  if (existing) throw ApiError.conflict('Email already in use', { field: 'email' });

  const user = await User.create({
    name,
    email,
    phone,
    password,
    preferences: {
      ...(currency && { currency }),
      ...(timezone && { timezone }),
    },
  });

  await Subscription.create({
    user: user._id,
    plan: SUBSCRIPTION_PLANS.FREE,
    startedAt: new Date(),
  });

  // Fire-and-forget email verification — token is persisted before any send
  // attempt so a flaky SMTP never blocks registration.
  await _issueVerificationToken(user, { baseUrl: ctx.verifyBaseUrl });

  const tokens = await issueTokenPair(user, ctx);
  return { user: sanitize(user), ...tokens };
};

const login = async ({ email, password }, ctx = {}) => {
  const user = await User.findOne({ email }).select('+password +status');
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden(`Account ${user.status}`);
  }

  const ok = await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokenPair(user, ctx);
  return { user: sanitize(user), ...tokens };
};

const rotateRefreshToken = async (presentedToken, ctx = {}) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(presentedToken);
  } catch (_) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  const stored = await RefreshToken.findOne({ jti: decoded.jti });
  if (!stored) throw ApiError.unauthorized('Refresh token not recognized');

  if (!stored.isActive()) {
    if (stored.revokedAt) {
      // Reuse of revoked token → revoke whole family for safety.
      await RefreshToken.updateMany(
        { user: stored.user, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
      logger.warn('Refresh token reuse detected — revoked all sessions', {
        userId: String(stored.user),
      });
    }
    throw ApiError.unauthorized('Refresh token revoked or expired');
  }

  if (stored.tokenHash !== hashToken(presentedToken)) {
    throw ApiError.unauthorized('Refresh token mismatch');
  }

  const user = await User.findById(stored.user).select('+status');
  if (!user || user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.unauthorized('User unavailable');
  }

  const newJtiVal = newJti();
  const newToken = signRefreshToken({ sub: String(user._id), role: user.role }, newJtiVal);
  const expiresAt = new Date(Date.now() + parseMs(env.JWT_REFRESH_EXPIRES_IN));

  await RefreshToken.create({
    user: user._id,
    jti: newJtiVal,
    tokenHash: hashToken(newToken),
    userAgent: ctx.userAgent || '',
    ip: ctx.ip || '',
    // Propagate the device link across rotations so revoke() can cascade
    // every refresh row in the chain. Stays null if the original login
    // happened before /devices was ever called.
    deviceId: stored.deviceId || null,
    expiresAt,
  });

  stored.revokedAt = new Date();
  stored.replacedByJti = newJtiVal;
  await stored.save();

  return {
    accessToken: buildAccess(user),
    refreshToken: newToken,
  };
};

const logout = async (presentedToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(presentedToken);
  } catch (_) {
    return;
  }
  await RefreshToken.updateOne(
    { jti: decoded.jti, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

const forgotPassword = async ({ email }, { resetBaseUrl } = {}) => {
  const user = await User.findOne({ email });
  if (!user) return; // No leak about whether the address exists.

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + parseMs(env.RESET_TOKEN_EXPIRES_IN));

  user.passwordResetToken = tokenHash;
  user.passwordResetExpires = expiresAt;
  await user.save({ validateBeforeSave: false });

  const expiresInMinutes = Math.round(parseMs(env.RESET_TOKEN_EXPIRES_IN) / 60_000);
  const baseUrl = resetBaseUrl || env.APP_URL;
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes,
    });
  } catch (err) {
    logger.error('Failed to send reset email', { message: err.message });
  }
};

const resetPassword = async ({ token, password }) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) throw ApiError.badRequest('Reset token is invalid or expired');

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Invalidate all existing refresh tokens — password change is a security event.
  await RefreshToken.updateMany(
    { user: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw ApiError.unauthorized();

  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw ApiError.badRequest('Current password is incorrect');

  user.password = newPassword;
  await user.save();

  await RefreshToken.updateMany(
    { user: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

// Resend a verification email to the authenticated user. Enforces a
// per-user cooldown to limit abuse; the public route additionally has
// IP-bucket rate limits via withRoute.
const sendVerification = async (userId, ctx = {}) => {
  const user = await User.findById(userId).select(
    '+emailVerificationToken +emailVerificationExpires +emailVerificationSentAt'
  );
  if (!user) throw ApiError.unauthorized();
  if (user.emailVerifiedAt) {
    return { alreadyVerified: true };
  }

  if (user.emailVerificationSentAt) {
    const elapsed = Date.now() - user.emailVerificationSentAt.getTime();
    if (elapsed < env.EMAIL_VERIFICATION_RESEND_COOLDOWN_MS) {
      const retryAfter = Math.ceil(
        (env.EMAIL_VERIFICATION_RESEND_COOLDOWN_MS - elapsed) / 1000
      );
      throw ApiError.tooMany(`Please wait ${retryAfter}s before requesting another email`);
    }
  }

  await _issueVerificationToken(user, { baseUrl: ctx.verifyBaseUrl });
  return { alreadyVerified: false };
};

// Consume a verification token. Idempotent: verifying a second time
// with a *valid* token still returns 200; verifying after the token has
// been cleared returns a generic invalid/expired error.
const verifyEmail = async ({ token }) => {
  const tokenHash = sha256(token);
  const user = await User.findOne({
    emailVerificationToken: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) throw ApiError.badRequest('Verification token is invalid or expired');

  user.emailVerifiedAt = user.emailVerifiedAt || new Date();
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  return { user: sanitize(user) };
};

// ---------- OTP email sign-in (passwordless) ----------
//
// Single flow that covers both new and returning users. Caller submits
// just an email; if no User exists we create one on the fly (no password
// set), generate a 6-digit one-time code, and email it. The user types
// the code back via `/auth/otp/verify` to receive a real DET token pair.
//
// Security:
//   - Code is sha256-hashed at rest.
//   - 10-minute TTL.
//   - Verify matches by email + code hash and consumes on success.
//   - Same "delivered" response regardless of whether the email existed
//     so the request endpoint can't be used as a user-enumeration oracle.

const OTP_TTL_MINUTES = 10;

const _issueOtp = async (user) => {
  // 6-digit zero-padded numeric code.
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  user.signInToken = sha256(code);
  user.signInTokenExpires = expiresAt;
  user.signInTokenSentAt = new Date();
  await user.save({ validateBeforeSave: false });

  try {
    const { sendOtpEmail } = require('../utils/mailer');
    await sendOtpEmail({
      to: user.email,
      name: user.name || '',
      code,
      expiresInMinutes: OTP_TTL_MINUTES,
    });
  } catch (err) {
    logger.warn('OTP email dispatch failed (code still stored)', {
      message: err.message,
    });
  }
};

const requestOtp = async ({ email, name }) => {
  const lower = String(email).toLowerCase().trim();
  let user = await User.findOne({ email: lower }).select('+status');

  if (!user) {
    // Lazy account creation — passwordless from day one.
    user = await User.create({
      name: name || lower.split('@')[0],
      email: lower,
    });
    await Subscription.create({
      user: user._id,
      plan: SUBSCRIPTION_PLANS.FREE,
      startedAt: new Date(),
    });
  } else if (user.status && user.status !== USER_STATUS.ACTIVE) {
    // Refuse silently — don't leak the status to the caller.
    return { delivered: true, expiresInMinutes: OTP_TTL_MINUTES };
  }

  await _issueOtp(user);
  return { delivered: true, expiresInMinutes: OTP_TTL_MINUTES };
};

const verifyOtp = async ({ email, code }, ctx = {}) => {
  const lower = String(email || '').toLowerCase().trim();
  const user = await User.findOne({ email: lower })
    .select('+status +signInToken +signInTokenExpires');

  // Uniform error for missing / wrong / expired code — never reveal
  // which, so the endpoint can't confirm whether an email is registered.
  const reject = () => {
    throw new ApiError(410, 'Code is invalid or expired', { code: 'OTP_INVALID' });
  };

  if (!user || !user.signInToken || !user.signInTokenExpires) reject();
  if (user.signInTokenExpires.getTime() <= Date.now()) reject();
  if (user.signInToken !== sha256(String(code))) reject();

  if (user.status && user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden(`Account ${user.status}`);
  }

  // One-shot consumption — clear the code before issuing the session.
  user.signInToken = undefined;
  user.signInTokenExpires = undefined;
  user.signInTokenSentAt = undefined;
  // Entering the emailed code proves the user owns the address.
  if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokenPair(user, ctx);
  return { user: sanitize(user), ...tokens };
};

// ---------- Google Sign-In ----------
//
// Exchange a Google ID token for DET access+refresh tokens. The flow:
//   1. Mobile calls google_sign_in plugin → gets an id_token signed by Google.
//   2. Forwards it here.
//   3. We verify the JWT against Google's hosted JWKS using google-auth-library,
//      matching audience against env.GOOGLE_CLIENT_ID.
//   4. Look up by `googleSub` first (stable across email changes), then by
//      email (link the Google identity onto an existing account).
//   5. New users get a fresh row with emailVerifiedAt = now (Google has
//      already verified the address), a default Subscription, and a token pair.
//
// Until env.GOOGLE_CLIENT_ID is set, this throws 503 — the mobile button
// stays hidden in that case so users never reach it.

const _verifyGoogleIdToken = async (idToken) => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new ApiError(503, 'Google sign-in not configured', {
      code: 'GOOGLE_NOT_CONFIGURED',
    });
  }
  let OAuth2Client;
  try {
    // Hide the optional-dep require from webpack's static analyser
    // (same trick as fcm.service / billing/google.js) so the build
    // succeeds when google-auth-library isn't installed yet.
    // eslint-disable-next-line no-eval
    const nodeRequire = eval('require');
    ({ OAuth2Client } = nodeRequire('google-auth-library'));
  } catch (_) {
    throw new ApiError(503, 'google-auth-library not installed', {
      code: 'GOOGLE_NOT_CONFIGURED',
    });
  }
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    throw ApiError.unauthorized('Invalid Google token');
  }
  if (!payload || !payload.sub || !payload.email) {
    throw ApiError.unauthorized('Google token missing required claims');
  }
  if (payload.email_verified === false) {
    throw ApiError.forbidden(
      'Google account email is not verified — verify it with Google first'
    );
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.given_name || 'New user',
    picture: payload.picture || null,
  };
};

const googleSignIn = async ({ idToken }, ctx = {}) => {
  const claims = await _verifyGoogleIdToken(idToken);

  // 1) Try by stable Google sub (handles email changes on the Google side).
  let user = await User.findOne({ googleSub: claims.sub }).select('+status');

  // 2) Fall back to email — link Google to an existing email account.
  if (!user) {
    user = await User.findOne({ email: claims.email }).select('+status');
    if (user) {
      user.googleSub = claims.sub;
      // Google has verified the email already; stamp if we hadn't.
      if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
      // Pick up a Google avatar if the user had none.
      if (!user.avatarUrl && claims.picture) user.avatarUrl = claims.picture;
      await user.save({ validateBeforeSave: false });
    }
  }

  // 3) Brand-new user — create the account.
  if (!user) {
    user = await User.create({
      name: claims.name,
      email: claims.email,
      // Bcrypt minimum is 8 chars; this random secret is unused (Google
      // is the auth method) but the field is required by the schema.
      password: crypto.randomBytes(24).toString('hex'),
      avatarUrl: claims.picture || undefined,
      googleSub: claims.sub,
      emailVerifiedAt: new Date(),
    });
    await Subscription.create({
      user: user._id,
      plan: SUBSCRIPTION_PLANS.FREE,
      startedAt: new Date(),
    });
  }

  if (user.status && user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden(`Account ${user.status}`);
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const tokens = await issueTokenPair(user, ctx);
  return { user: sanitize(user), ...tokens };
};

module.exports = {
  register,
  login,
  googleSignIn,
  requestOtp,
  verifyOtp,
  rotateRefreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  sendVerification,
  verifyEmail,
  sanitize,
};
