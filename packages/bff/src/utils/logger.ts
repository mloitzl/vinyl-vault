import pino from 'pino';
import pinoHttp from 'pino-http';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Ensure .env is loaded before computing transport options
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: resolve(__dirname, '../../../.env') });

const isProduction = process.env.NODE_ENV === 'production';
const enablePretty = !isProduction && (process.env.ENABLE_PRETTY_LOGS ?? 'true') === 'true';

const transport = enablePretty
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    })
  : undefined;

const baseOptions = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
};

export const logger = transport ? pino(baseOptions, transport) : pino(baseOptions);

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
