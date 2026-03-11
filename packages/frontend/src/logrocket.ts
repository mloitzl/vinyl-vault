// LogRocket — MUST be imported before any application code so that it can
// capture network requests, console output, and Redux state from the start.
//
// Provides:
//   - Session replay with full user interaction recording
//   - JavaScript error capture with stack traces and session context
//   - Network request logging (XHR, fetch)
//   - Console log capture
//   - Redux DevTools integration (if applicable)
//
// Session replays are accessible in the LogRocket dashboard and can be linked
// to support tickets or correlated with backend traces via the session URL.
import LogRocket from 'logrocket';

const appId = import.meta.env.VITE_LOGROCKET_APP_ID;

// Skip initialisation when the App ID is absent (local dev without LR configured).
if (appId) {
  LogRocket.init(appId, {
    network: {
      // Redact auth tokens and session cookies from recorded network requests.
      requestSanitizer: (request) => {
        if (request.headers['Authorization']) {
          request.headers['Authorization'] = '[redacted]';
        }
        if (request.headers['Cookie']) {
          request.headers['Cookie'] = '[redacted]';
        }
        return request;
      },
    },
  });
}
