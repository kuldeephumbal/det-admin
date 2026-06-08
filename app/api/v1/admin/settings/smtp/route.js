// Using ESM `export const` syntax (rather than CommonJS `exports.GET = …`)
// silences Next.js 14.2's "Detected default export" warning: the CJS-to-ESM
// interop layer synthesises a `default` property pointing at the whole
// module.exports object, which the App Router validator flags.
import Joi from 'joi';
import { withRoute } from '@/lib/api/withRoute';
import { withAudit } from '@/lib/api/auditLog';
import ApiResponse from '@/lib/utils/ApiResponse';
import settings from '@/lib/services/settings.service';

// GET /api/v1/admin/settings/smtp — current effective config (passwords
// never leave the server — only a `passwordSet` flag + a masked hint).
export const GET = withRoute(
  async () => ApiResponse.ok(await settings.getSmtpForAdmin()),
  { auth: 'admin' }
);

// PUT /api/v1/admin/settings/smtp — update SMTP credentials. Omit
// `password` to keep the current value; pass an empty string to wipe.
//
// Host is validated as a non-empty string only (no `.hostname()` — that
// uses RFC 1123 which rejects trailing dots and underscores that some
// real SMTP providers tolerate). Bad hosts surface as a clear
// nodemailer connect error in the test-email step, which is more
// actionable than a vague form-level rejection.
const updateSchema = {
  body: Joi.object({
    // Host must look like a hostname — at minimum, no `@` (email),
    // no whitespace, no scheme prefix. Full RFC 1123 hostname check
    // is too strict for some real providers, but rejecting `@` and
    // `://` catches the common confusion of pasting an email address
    // or a URL into the host field, which manifests downstream as a
    // confusing DNS EBADNAME error at send time.
    host: Joi.string()
      .trim()
      .min(1)
      .max(254)
      .pattern(/^[^\s@]+$/, 'hostname (no whitespace, no "@")')
      .custom((value, helpers) => {
        if (/^https?:\/\//i.test(value) || value.includes('/')) {
          return helpers.error('any.invalid', {
            message: 'Host should be a hostname like "smtp.gmail.com", not a URL.',
          });
        }
        return value;
      })
      .required(),
    port: Joi.number().integer().min(1).max(65535).default(587),
    user: Joi.string().trim().min(1).max(254).required(),
    password: Joi.string().allow('').max(512).optional(),
    from: Joi.string().trim().min(1).max(254).required(),
  }),
};

export const PUT = withRoute(
  withAudit(
    async ({ user, body }) => {
      const updated = await settings.updateSmtp(body, user);
      return ApiResponse.ok(updated, 'SMTP settings updated');
    },
    {
      action: 'settings.smtp.update',
      target: () => ({ type: 'app_setting', id: 'smtp' }),
      // Never log the password itself; the changed-fields list is enough
      // for audit trail purposes.
      meta: ({ body }) => ({
        changedFields: Object.keys(body).filter((k) => k !== 'password'),
        passwordChanged: typeof body.password === 'string' && body.password.length > 0,
      }),
    }
  ),
  { auth: 'admin', schema: updateSchema, rateLimit: { bucket: 'auth', windowMs: 60_000, max: 20 } }
);

export const OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
