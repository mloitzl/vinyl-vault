// New Relic Browser Agent — MUST be imported before instrumentation.ts and
// any application code so that it can capture page-load timing, JS errors,
// and AJAX calls from the very first moment the app runs.
//
// Provides capabilities that OTel web instrumentation doesn't cover:
//   - Core Web Vitals (LCP, INP, CLS)
//   - JavaScript error reporting with stack traces
//   - Session traces and browser interactions
//   - Page-load / route-change performance timeline in the NR Browser UI
//
// The OTel setup in instrumentation.ts continues to handle distributed trace
// correlation (W3C traceparent headers on fetch requests).
import { BrowserAgent } from '@newrelic/browser-agent/loaders/browser-agent';

const accountID  = import.meta.env.VITE_NEW_RELIC_ACCOUNT_ID;
const agentID    = import.meta.env.VITE_NEW_RELIC_AGENT_ID;
const appID      = import.meta.env.VITE_NEW_RELIC_APPLICATION_ID;
const licenseKey = import.meta.env.VITE_NEW_RELIC_LICENSE_KEY;

// Skip initialisation in environments where credentials are absent
// (e.g. CI builds, unit tests, or local dev without NR configured).
if (accountID && licenseKey) {
  const agent = new BrowserAgent({
    init: {
      session_replay: {
        enabled: true,
        block_selector: '',
        mask_text_selector: '*',
        sampling_rate: 10.0,
        error_sampling_rate: 100.0,
        mask_all_inputs: true,
        collect_fonts: true,
        inline_images: false,
        inline_stylesheet: true,
        fix_stylesheets: true,
        preload: false,
        mask_input_options: {},
      },
      distributed_tracing: {
        // Emit W3C traceparent headers — compatible with the OTel traces
        // already flowing through the BFF and Backend.
        enabled: true,
        cors_use_newrelic_header: true,
        cors_use_tracecontext_headers: true,
        allowed_origins: [
          'localhost',
          'vinylvault.antisocializer.org',
          'vinyl-vault-demo.loitzl.com',
        ],
      },
      performance: { capture_measures: true },
      browser_consent_mode: { enabled: false },
      privacy: { cookies_enabled: true },
      ajax: { deny_list: ['bam.eu01.nr-data.net'], capture_payloads: 'none' },
    },
    info: {
      beacon: 'bam.eu01.nr-data.net',
      errorBeacon: 'bam.eu01.nr-data.net',
      licenseKey,
      applicationID: appID,
      sa: 1,
    },
    loader_config: {
      accountID,
      trustKey: accountID,
      agentID,
      licenseKey,
      applicationID: appID,
    },
  });

  agent.setCustomAttribute('environment', import.meta.env.VITE_OTEL_ENVIRONMENT ?? 'dev');
}

