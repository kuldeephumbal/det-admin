const Joi = require('joi');

const timezone = Joi.string().pattern(/^[A-Za-z_]+\/[A-Za-z_+\-0-9]+$/).max(60);

const dashboard = {
  query: Joi.object({
    timezone,
  }),
};

const daily = {
  query: Joi.object({
    days: Joi.number().integer().min(1).max(180).default(30),
    timezone,
  }),
};

const weekly = {
  query: Joi.object({
    weeks: Joi.number().integer().min(1).max(52).default(12),
    timezone,
  }),
};

const monthly = {
  query: Joi.object({
    months: Joi.number().integer().min(1).max(36).default(12),
    timezone,
  }),
};

const yearly = {
  query: Joi.object({
    years: Joi.number().integer().min(1).max(10).default(5),
    timezone,
  }),
};

const categoryBreakdown = {
  query: Joi.object({
    from: Joi.date().iso(),
    to: Joi.date().iso().min(Joi.ref('from')),
    period: Joi.string().valid('today', 'week', 'month', 'year').default('month'),
    timezone,
  }),
};

const trends = {
  query: Joi.object({
    days: Joi.number().integer().min(7).max(365).default(90),
    timezone,
  }),
};

const calendar = {
  query: Joi.object({
    from: Joi.date().iso().required(),
    // Cap the window at 60 days. The Joi `.max` rule mirrors the
    // service-side CALENDAR_MAX_DAYS so attackers can't request
    // unbounded ranges.
    to: Joi.date()
      .iso()
      .required()
      .min(Joi.ref('from'))
      .custom((value, helpers) => {
        const from = new Date(helpers.state.ancestors[0].from);
        const days = Math.ceil((value.getTime() - from.getTime()) / 86400_000);
        if (days > 60) return helpers.error('any.custom', { message: 'Range exceeds 60 days' });
        return value;
      }, 'calendar range cap'),
    timezone,
  }),
};

module.exports = { dashboard, daily, weekly, monthly, yearly, categoryBreakdown, trends, calendar };
