const { withRoute } = require('@/lib/api/withRoute');
const ApiResponse = require('@/lib/utils/ApiResponse');
const v = require('@/lib/validators/split.validator');
const { normalizeMany } = require('@/lib/utils/phone');
const User = require('@/lib/models/User');

// POST /api/v1/contacts/match — given raw phone numbers from the user's
// address book, return which ones map to existing DET users (so the app
// can show "on DET → add" vs "invite via SMS"). Returns only minimal
// public info; no reverse lookup of arbitrary numbers beyond match/no-match.
exports.POST = withRoute(
  async ({ body }) => {
    const map = normalizeMany(body.phones); // raw -> E.164 | null
    const e164s = [...new Set([...map.values()].filter(Boolean))];
    const users = e164s.length
      ? await User.find({ phoneNormalized: { $in: e164s } })
          .select('name phoneNormalized avatarUrl')
          .lean()
      : [];
    const byPhone = {};
    users.forEach((u) => {
      byPhone[u.phoneNormalized] = { id: String(u._id), name: u.name, avatarUrl: u.avatarUrl || null };
    });
    const contacts = [...map.entries()].map(([raw, e164]) => ({
      input: raw,
      phone: e164,
      onDet: e164 ? Boolean(byPhone[e164]) : false,
      user: e164 ? byPhone[e164] || null : null,
    }));
    return ApiResponse.ok({ contacts });
  },
  { auth: true, schema: v.matchContacts }
);

exports.OPTIONS = withRoute(async () => new Response(null, { status: 204 }), { skipDb: true });
