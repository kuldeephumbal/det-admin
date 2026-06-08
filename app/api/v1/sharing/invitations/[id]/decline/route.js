const Joi = require('joi');
const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const sharing = require('@/lib/services/sharing.service');
const { objectId } = require('@/lib/validators/common.validator');

exports.POST = withRoute(
  async ({ user, params }) => {
    const result = await sharing.declineInvitation(user.id, params.id);
    return ApiResponse.ok(result, 'Invitation declined');
  },
  {
    auth: true,
    schema: { params: Joi.object({ id: objectId.required() }) },
    rateLimit: { bucket: 'default', windowMs: 60 * 1000, max: 30 },
  }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
