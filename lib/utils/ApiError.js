class ApiError extends Error {
  constructor(statusCode, message, { code, details, isOperational = true } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || ApiError.codeFromStatus(statusCode);
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static codeFromStatus(status) {
    const map = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return map[status] || 'ERROR';
  }

  static badRequest(message, details)  { return new ApiError(400, message, { details }); }
  static unauthorized(message = 'Unauthorized') { return new ApiError(401, message); }
  static forbidden(message = 'Forbidden')      { return new ApiError(403, message); }
  static notFound(message = 'Resource not found') { return new ApiError(404, message); }
  static conflict(message, details)    { return new ApiError(409, message, { details }); }
  static validation(message, details)  { return new ApiError(422, message, { details, code: 'VALIDATION_ERROR' }); }
  static tooMany(message = 'Too many requests') { return new ApiError(429, message); }
  static internal(message = 'Internal server error') { return new ApiError(500, message, { isOperational: false }); }
}

module.exports = ApiError;
