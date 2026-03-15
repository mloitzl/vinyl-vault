import pino from 'pino';
import pinoHttp from 'pino-http';
import { trace } from '@opentelemetry/api';
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

// Adds active OTel trace/span IDs to every log line so Betterstack can
// correlate log entries with the distributed trace they belong to.
const mixin = () => {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  return {
    trace_id: ctx.traceId,
    span_id: ctx.spanId,
  };
};

const baseOptions = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  mixin,
};

export const logger = transport ? pino(baseOptions, transport) : pino(baseOptions);

export const httpLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Hoist logrocket_session to the top level of the log line so it survives
  // the OTLP → Elastic pipeline (nested req.* fields are dropped; top-level
  // fields are preserved as labels alongside trace_id / span_id).
  customProps: (req) => ({
    logrocket_session: (req.headers['x-logrocket-session'] as string) || undefined,
  }),
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
