const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { ROLES, USER_STATUS, CURRENCIES, SUBSCRIPTION_PLANS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email'],
      index: true,
    },
    phone: { type: String, trim: true, match: [/^\+?[0-9\s-]{7,20}$/, 'Invalid phone number'] },
    // Passwordless from launch — most users sign in via magic link or
    // Google. Password is kept optional so existing email/password rows
    // continue to work and admins still have a secret to authenticate
    // with against the admin panel.
    password: { type: String, minlength: 8, select: false },
    // Magic link sign-in. Same hash-at-rest pattern as password reset
    // and email verification tokens — the raw token is only ever in the
    // email body.
    signInToken: { type: String, select: false },
    signInTokenExpires: { type: Date, select: false },
    signInTokenSentAt: { type: Date, select: false },
    avatarUrl: { type: String, trim: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER, index: true },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
      index: true,
      select: false,
    },
    plan: { type: String, enum: Object.values(SUBSCRIPTION_PLANS), default: SUBSCRIPTION_PLANS.FREE },
    // Denormalized from Subscription.currentPeriodEnd so `requirePlan`
    // can gate routes without an extra DB hit. Null = no provider-backed
    // entitlement (free tier OR lifetime plan — distinguish by `plan`).
    planValidUntil: { type: Date, default: null },
    preferences: {
      currency: { type: String, enum: CURRENCIES, default: 'INR' },
      locale: { type: String, default: 'en-IN' },
      timezone: { type: String, default: 'Asia/Kolkata' },
      themeMode: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
      notifications: {
        budgetAlerts: { type: Boolean, default: true },
        monthlySummary: { type: Boolean, default: true },
        expenseReminders: { type: Boolean, default: true },
        recurringReminders: { type: Boolean, default: true },
      },
    },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: { type: Date, select: false },
    emailVerifiedAt: { type: Date, default: null },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    emailVerificationSentAt: { type: Date, select: false },
    // Google's stable `sub` claim, populated when the user signs in via
    // Google. Uniqueness is enforced by the PARTIAL index declared below
    // — NOT inline here. A plain sparse+unique index does not work,
    // because `default: null` writes an explicit null and sparse still
    // indexes explicit nulls, so multiple passwordless users would all
    // collide on `googleSub: null`.
    googleSub: { type: String, default: null },
    lastLoginAt: Date,
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.passwordChangedAt;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpires;
        delete ret.emailVerificationSentAt;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Enforce one row per Google account, but ONLY for rows whose googleSub
// is actually a string. Passwordless (email/magic-link) users store null
// and are excluded from this partial index entirely, so they never
// collide with each other on `googleSub: null`.
userSchema.index(
  { googleSub: 1 },
  { unique: true, partialFilterExpression: { googleSub: { $type: 'string' } } }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, env.BCRYPT_SALT_ROUNDS);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isPasswordChangedAfter = function isPasswordChangedAfter(jwtIatSec) {
  if (!this.passwordChangedAt) return false;
  return Math.floor(this.passwordChangedAt.getTime() / 1000) > jwtIatSec;
};

userSchema.query.notDeleted = function notDeleted() {
  return this.where({ deletedAt: null });
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
