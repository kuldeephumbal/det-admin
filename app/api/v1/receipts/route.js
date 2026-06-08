const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const receipts = require('@/lib/services/receipt.service');
const v = require('@/lib/validators/receipt.validator');
const { MAX_RECEIPT_SIZE_BYTES } = require('@/lib/validators/receipt.validator');
const ApiError = require('@/lib/utils/ApiError');

// POST /api/v1/receipts — multipart upload of a receipt image.
//
// withRoute's body parser skips non-JSON content types, leaving the
// raw stream intact for req.formData(). Size cap + mime check happen
// inside the service.
exports.POST = withRoute(
  async ({ req, user }) => {
    // Cheap pre-flight: reject obvious oversize bodies before parsing.
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength && contentLength > MAX_RECEIPT_SIZE_BYTES + 4096) {
      throw ApiError.badRequest(`Upload exceeds ${MAX_RECEIPT_SIZE_BYTES} bytes`);
    }

    const form = await req.formData();
    const file = form.get('file');
    const scan = await receipts.enqueue(user.id, file);
    return ApiResponse.created(scan, 'Receipt queued for OCR');
  },
  {
    auth: true,
    requireVerified: true,
    plan: 'premium',
    rateLimit: { bucket: 'default', windowMs: 60 * 1000, max: 10 },
  }
);

// GET /api/v1/receipts — paginated scan history for the caller.
exports.GET = withRoute(
  async ({ user, query }) => {
    const { items, page, limit, total } = await receipts.list(user.id, query);
    return ApiResponse.paginated(items, { page, limit, total });
  },
  { auth: true, plan: 'premium', schema: v.listReceipts }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
