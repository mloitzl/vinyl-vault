// OpenTelemetry SDK initialisation — loaded via Node's --import flag BEFORE
// any application modules, so auto-patches (express, apollo, mongodb, http, …)
// are applied on the very first import of those libraries.

// Must load .env before the SDK reads OTEL_EXPORTER_OTLP_* env vars.
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: resolve(__dirname, '../../../.env') });

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import pino from 'pino';

// Minimal logger for the instrumentation bootstrap — avoids importing the
// app logger (which loads dotenv, pino-http, etc.) before the SDK is ready.
const log = pino({
  name: 'otel',
  level: process.env.LOG_LEVEL ?? 'info',
});

// OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS are read
// automatically from the environment by both exporters.
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'vv-bff',
  }),
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 30_000,
  }),
  // pino instrumentation (included in auto-instrumentations-node) bridges
  // pino log calls → OTel LogRecords, which are then exported via OTLP.
  logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],
  instrumentations: [
    getNodeAutoInstrumentations({
      // fs instrumentation generates excessive noise without useful signal.
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

try {
  sdk.start();
  log.info(
    {
      service: process.env.OTEL_SERVICE_NAME ?? 'vv-bff',
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '(not set!)',
      headersSet: !!process.env.OTEL_EXPORTER_OTLP_HEADERS,
    },
    'OTel SDK started'
  );
} catch (err) {
  log.error({ err }, 'OTel SDK failed to start');
}

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => log.info('OTel SDK shut down'))
    .catch((err) => log.error({ err }, 'OTel SDK shutdown error'))
    .finally(() => process.exit(0));
});
