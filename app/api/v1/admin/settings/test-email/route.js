// ESM `export const` syntax silences Next.js 14.2's "Detected default
// export" warning that fires on CJS modules via interop synthesis.
import Joi from 'joi';
import { withRoute } from '@/lib/api/withRoute';
import { withAudit } from '@/lib/api/auditLog';
import ApiResponse from '@/lib/utils/ApiResponse';
import admin from '@/lib/services/admin.service';

// POST /api/v1/admin/settings/test-email — admin-only smoke test for
// the configured SMTP transport. Audited so we know who pinged what.
export const POST = withRoute(
  withAudit(
    async ({ user, body }) => {
      const result = await admin.sendTestEmail({
        to: body.to,
        actor: { name: user.doc?.name, email: user.email },
      });
      return ApiResponse.ok(result, 'Test email dispatched');
    },
    {
      action: 'settings.smtp.test',
      target: ({ body }) => ({ type: 'smtp_test', id: body.to }),
      meta: ({ body }) => ({ to: body.to }),
    }
  ),
  {
    auth: 'admin',
    schema: {
      body: Joi.object({
        to: Joi.string().email({ minDomainSegments: 2 }).max(254).required(),
      }),
    },
    rateLimit: { bucket: 'auth', windowMs: 60 * 1000, max: 10 },
  }
);

export const OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
