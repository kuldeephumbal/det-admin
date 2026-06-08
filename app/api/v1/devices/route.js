const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const deviceService = require('@/lib/services/device.service');
const v = require('@/lib/validators/device.validator');

// POST /api/v1/devices — register (or refresh) the caller's device.
// Idempotent on (user, fcmToken). On first-time registration for a
// user, fires a "new device" notification to the user's other devices.
exports.POST = withRoute(
  async ({ body, user, ip, userAgent }) => {
    const device = await deviceService.register(user.id, body, { ip, userAgent });
    return ApiResponse.created(device, 'Device registered');
  },
  {
    auth: true,
    schema: v.registerDevice,
    rateLimit: { bucket: 'auth', windowMs: 15 * 60 * 1000, max: 60 },
  }
);

// GET /api/v1/devices — list the caller's active devices, most recent
// first. Accepts an optional `?currentDeviceId=...` hint so the UI can
// render a "this device" badge.
exports.GET = withRoute(
  async ({ user, query }) => {
    const result = await deviceService.list(user.id, {
      currentDeviceId: query.currentDeviceId || null,
    });
    return ApiResponse.ok(result);
  },
  { auth: true, schema: v.listDevices }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
