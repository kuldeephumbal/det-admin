import { NextResponse } from 'next/server';
import Joi from 'joi';

import connectDB from '@/lib/db';
import ApiError from '@/lib/utils/ApiError';
import User from '@/lib/models/User';
import { email } from '@/lib/validators/common.validator';
import {
  signAdminSession,
  sessionCookieName,
  cookieOptions,
  clearedCookieOptions,
} from '@/lib/admin/session';
import { USER_STATUS } from '@/lib/config/constants';
import logger from '@/lib/utils/logger';

const loginSchema = Joi.object({
  email: email.required(),
  password: Joi.string().required(),
});

// Recognize "can't reach the DB" so the client can render a friendly toast
// instead of dumping a raw socket error onto the UI.
const isConnectionFailure = (err) => {
  const code = err?.code || err?.cause?.code;
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)) return true;
  if (err?.name === 'MongooseServerSelectionError') return true;
  if (
    typeof err?.message === 'string' &&
    /ECONNREFUSED|getaddrinfo|server selection/i.test(err.message)
  ) {
    return true;
  }
  return false;
};

const errorResponse = (status, code, message, details) =>
  NextResponse.json(
    { success: false, error: { code, message, ...(details && { details }) } },
    { status }
  );

export async function POST(req) {
  try {
    const raw = await req.json().catch(() => null);
    if (!raw) return errorResponse(400, 'BAD_REQUEST', 'Malformed JSON body');

    const { error, value } = loginSchema.validate(raw, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return errorResponse(
        422,
        'VALIDATION_ERROR',
        'Validation failed',
        error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))
      );
    }

    await connectDB();

    const user = await User.findOne({ email: value.email }).select('+password +status');
    if (!user) return errorResponse(401, 'UNAUTHORIZED', 'Invalid email or password');
    if (user.status !== USER_STATUS.ACTIVE) {
      return errorResponse(403, 'FORBIDDEN', `Account ${user.status}`);
    }
    if (user.role !== 'admin') {
      return errorResponse(403, 'FORBIDDEN', 'This account is not an admin');
    }

    const ok = await user.comparePassword(value.password);
    if (!ok) return errorResponse(401, 'UNAUTHORIZED', 'Invalid email or password');

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signAdminSession(user);
    const res = NextResponse.json({
      success: true,
      message: 'Signed in',
      data: {
        user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
      },
    });
    res.cookies.set(sessionCookieName, token, cookieOptions());
    return res;
  } catch (err) {
    if (isConnectionFailure(err)) {
      logger.error('admin session login — DB unreachable', { message: err.message });
      return errorResponse(
        503,
        'SERVICE_UNAVAILABLE',
        "Can't reach the database right now. Please try again in a moment."
      );
    }
    if (err instanceof ApiError) {
      return errorResponse(err.statusCode, err.code, err.message, err.details);
    }
    logger.error('admin session login failed', { message: err.message, stack: err.stack });
    return errorResponse(500, 'INTERNAL_ERROR', 'Something went wrong on our side.');
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: 'Signed out' });
  res.cookies.set(sessionCookieName, '', clearedCookieOptions());
  return res;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
