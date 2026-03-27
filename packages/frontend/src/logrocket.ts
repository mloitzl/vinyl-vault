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

// Cached session URL — populated asynchronously by LogRocket once the session starts.
// Used to inject X-LogRocket-Session on outgoing requests for backend trace correlation.
let _sessionURL: string | null = null;

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

  // Capture the session URL once available so it can be attached to API requests.
  LogRocket.getSessionURL((url) => {
    _sessionURL = url;
  });
}

/**
 * Returns the current LogRocket session URL, or null if LogRocket is not
 * initialised or the session hasn't started yet.
 * Attach this as `X-LogRocket-Session` on outgoing requests so backend
 * log lines (which already carry OTel trace_id) can be correlated with
 * the matching frontend session replay.
 */
export function getSessionURL(): string | null {
  return _sessionURL;
}

/**
 * Associate the current LogRocket session with an authenticated user.
 * No-op when LogRocket is not initialised (e.g. local dev without app ID).
 */
export function identifyUser(user: {
  id: string;
  githubLogin: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}) {
  if (!appId) return;
  LogRocket.identify(user.id, {
    name: user.displayName,
    email: user.email ?? '',
    githubLogin: user.githubLogin,
    avatar: user.avatarUrl ?? '',
  });
}
