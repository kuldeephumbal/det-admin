// withAudit(handler, options) — wraps an admin Route Handler so that a
// successful call writes a row to the AuditLog collection.
//
// Designed to compose INSIDE withRoute, like this:
//
//   exports.PATCH = withRoute(
//     withAudit(
//       async ({ params, body }) => admin.updateUserStatus(params.id, body.status),
//       {
//         action: 'user.updateStatus',
//         target: ({ params }) => ({ type: 'user', id: params.id }),
//         meta:   ({ body })   => ({ newStatus: body.status }),
//       }
//     ),
//     { auth: 'admin', schema: v.updateUserStatus }
//   );
//
// The audit write is fire-and-forget: it never blocks the response and never
// causes a successful mutation to be reported as failed. Errors are swallowed
// after being logged by audit.service.js#record.
//
// Options:
//   action  — string OR (ctx, result) => string  (required)
//   target  — { type, id }  OR (ctx, result) => { type, id }
//   before  — async (ctx) => snapshot   (called BEFORE the handler runs)
//   after   — (ctx, result) => snapshot OR static value
//   meta    — (ctx, result) => object   OR static value
const audit = require('../services/audit.service');

const _resolve = (val, ...args) => (typeof val === 'function' ? val(...args) : val);

function withAudit(handler, options = {}) {
  return async function auditedHandler(ctx) {
    let before = null;
    if (typeof options.before === 'function') {
      try {
        before = await options.before(ctx);
      } catch (_err) {
        // A failed snapshot must not block the handler.
        before = null;
      }
    } else if (options.before !== undefined) {
      before = options.before;
    }

    const result = await handler(ctx);

    // Fire-and-forget — the response is already shaped; logging the audit
    // entry must never make a successful mutation look like a failure.
    Promise.resolve()
      .then(async () => {
        const action = _resolve(options.action, ctx, result);
        if (!action) return;

        const target = _resolve(options.target, ctx, result) || null;
        const after = options.after !== undefined ? _resolve(options.after, ctx, result) : null;
        const meta = options.meta !== undefined ? _resolve(options.meta, ctx, result) : null;

        await audit.record({
          actor: {
            _id: ctx.user?.id,
            email: ctx.user?.email,
            name: ctx.user?.doc?.name || '',
          },
          action,
          target,
          before,
          after,
          meta,
          statusCode: result?.statusCode || 200,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        });
      })
      .catch(() => {});

    return result;
  };
}

module.exports = { withAudit };
