const ApiError = require('../utils/ApiError');

// Validate a Joi schema against an object. Returns the coerced value, or throws ApiError(422).
const validate = (schema, value, location = 'body') => {
  if (!schema) return value;
  const { error, value: coerced } = schema.validate(value, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
      location,
    }));
    throw ApiError.validation('Validation failed', details);
  }
  return coerced;
};

module.exports = { validate };
