// OpenTelemetry SDK initialisation — loaded via Node's --import flag BEFORE
// any application modules, so auto-patches (express, apollo, mongodb, http, …)
// are applied on the very first import of those libraries.

// Load .env for local development. In k8s, env vars come from the pod spec
// (ConfigMap/Secret) so this is a no-op (dotenv silently skips missing files).
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

// IMPORTANT: Do NOT import pino here. The pino OTel instrumentation patches
// pino during sdk.start(). If pino is imported before start(), the ESM module
// hook misses it and log records are never bridged to the LoggerProvider.
// Use console for bootstrap logging only.

// OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS are read
// automatically from the environment by all exporters.
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'vv-backend',
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
  console.log(JSON.stringify({
    level: 30,
    time: Date.now(),
    name: 'otel',
    service: process.env.OTEL_SERVICE_NAME ?? 'vv-backend',
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? '(not set!)',
    headersSet: !!process.env.OTEL_EXPORTER_OTLP_HEADERS,
    msg: 'OTel SDK started',
  }));
} catch (err) {
  console.error('[OTel] SDK failed to start', err);
}

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('[OTel] SDK shut down'))
    .catch((err) => console.error('[OTel] SDK shutdown error', err))
    .finally(() => process.exit(0));
});
