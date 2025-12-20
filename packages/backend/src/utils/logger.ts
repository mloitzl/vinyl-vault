import pino from 'pino';
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
  // Match BFF: enable pretty logs via direct env in non-production
};

export const logger = transport ? pino(baseOptions, transport) : pino(baseOptions);
