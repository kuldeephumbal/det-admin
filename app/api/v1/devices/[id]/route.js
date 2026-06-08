const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const deviceService = require('@/lib/services/device.service');
const v = require('@/lib/validators/device.validator');

// DELETE /api/v1/devices/:id — revoke a device. Flips the Device row
// inactive, clears the FCM token (so push fan-out skips it), and
// cancels every refresh token linked to that device. The revoked
// device's next access-token refresh will get 401 → mobile interceptor
// translates to force-logout.
exports.DELETE = withRoute(
  async ({ params, user }) => {
    const device = await deviceService.revoke(user.id, params.id);
    return ApiResponse.ok(device, 'Device revoked');
  },
  { auth: true, schema: v.deviceParam }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
