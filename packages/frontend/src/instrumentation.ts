// OpenTelemetry Web instrumentation — MUST be the first import in main.tsx.
// Generates the root span when a user interacts with the app and propagates
// the W3C traceparent header on fetch requests to the BFF, enabling
// end-to-end distributed tracing: Browser → BFF → Backend → MongoDB.
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

// Send traces directly to New Relic's OTLP HTTP endpoint.
// VITE_NEW_RELIC_LICENSE_KEY must be a New Relic Ingest (License) key —
// these are write-only and safe to embed in client-side bundles.
const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'vv-frontend',
    'deployment.environment': import.meta.env.VITE_OTEL_ENVIRONMENT ?? 'dev',
  }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: 'https://otlp.nr-data.net:4318/v1/traces',
        headers: {
          'api-key': import.meta.env.VITE_NEW_RELIC_LICENSE_KEY ?? '',
        },
      })
    ),
  ],
});

registerInstrumentations({
  instrumentations: [
    getWebAutoInstrumentations({
      '@opentelemetry/instrumentation-fetch': {
        // Inject traceparent/tracestate headers on requests to these origins.
        // This is what links a browser click to the BFF span in New Relic.
        propagateTraceHeaderCorsUrls: [
          /localhost:\d+/,
          /vinylvault\.antisocializer\.org/,
          /vinylvault\.loitzl\.com/,
        ],
      },
      // XMLHttpRequest is not used by this app (Relay uses fetch).
      '@opentelemetry/instrumentation-xml-http-request': { enabled: false },
    }),
  ],
});

provider.register();
