const { createLogger, format, transports } = require('winston');

const level = process.env.LOG_LEVEL || 'info';
const isProd = process.env.NODE_ENV === 'production';

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level: lvl, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${lvl}: ${message}${rest}`;
  })
);

const jsonFormat = format.combine(format.timestamp(), format.errors({ stack: true }), format.json());

const logger = createLogger({
  level,
  format: isProd ? jsonFormat : consoleFormat,
  defaultMeta: { service: 'det' },
  transports: [new transports.Console()],
});

module.exports = logger;
