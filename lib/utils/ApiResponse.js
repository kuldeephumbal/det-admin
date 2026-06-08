const { NextResponse } = require('next/server');

const send = (status, payload, headers) =>
  NextResponse.json(
    { success: status < 400, ...payload },
    { status, ...(headers && { headers }) }
  );

module.exports = {
  ok: (data, message = 'OK', meta) =>
    send(200, { message, data, ...(meta && { meta }) }),

  created: (data, message = 'Created') =>
    send(201, { message, data }),

  noContent: () => new NextResponse(null, { status: 204 }),

  paginated: (items, { page, limit, total }, message = 'OK') =>
    send(200, {
      message,
      data: items,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    }),

  error: (statusCode, body, headers) => send(statusCode, body, headers),
};
