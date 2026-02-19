// Environment configuration
// Centralized environment variable access with validation

import { logger } from '../utils/logger.js';

// Use a getter function to ensure env vars are read after dotenv loads
function getConfig() {
  return {
    // Server
    port: parseInt(process.env.BFF_PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // GitHub OAuth
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/auth/github/callback',
      appId: process.env.GITHUB_APP_ID || '',
      appPrivateKeyPath: process.env.GITHUB_APP_PRIVATE_KEY_PATH || '',
      appWebhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET || '',
      appInstallationUrl:
        process.env.GITHUB_APP_INSTALLATION_URL ||
        'https://github.com/apps/vinyl-vault/installations/new',
    },

    // Session
    session: {
      secret: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
      cookieName: 'vinylvault.sid',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      // When set, the session cookie is scoped to this domain (e.g. '.vinylvault.example.com')
      // so it is shared across subdomains (frontend on Vercel + API on Koyeb).
      cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    },

    // JWT (for BFF to Backend communication)
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },

    // MongoDB
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/vinylvault',
    },

    // Backend
    backend: {
      url: process.env.BACKEND_URL || 'http://localhost:4000/graphql',
    },

    // Frontend URL (for redirects after auth)
    frontend: {
      url: process.env.FRONTEND_URL || 'http://localhost:3000',
    },

    // Feature flags
    features: {
      enableTenantFeatures: process.env.ENABLE_TENANT_FEATURES !== 'false',
    },

    // Check if in production
    isProduction: process.env.NODE_ENV === 'production',
  } as const;
}

// Lazy-loaded config - reads env vars when first accessed
let _config: ReturnType<typeof getConfig> | null = null;

export const config = new Proxy({} as ReturnType<typeof getConfig>, {
  get(_, prop: keyof ReturnType<typeof getConfig>) {
    if (!_config) {
      _config = getConfig();
    }
    return _config[prop];
  },
});

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.github.clientId) {
    errors.push('GITHUB_CLIENT_ID is required');
  }
  if (!config.github.clientSecret) {
    errors.push('GITHUB_CLIENT_SECRET is required');
  }
  if (!config.github.appId) {
    errors.push('GITHUB_APP_ID is required for GitHub App installation flow');
  }
  if (!config.github.appWebhookSecret) {
    errors.push('GITHUB_APP_WEBHOOK_SECRET is required for webhook validation');
  }
  if (!config.github.appPrivateKeyPath) {
    errors.push('GITHUB_APP_PRIVATE_KEY_PATH is required to sign GitHub App requests');
  }
  if (config.isProduction) {
    if (config.session.secret === 'dev-session-secret-change-in-production') {
      errors.push('SESSION_SECRET must be set in production');
    }
    if (config.jwt.secret === 'dev-jwt-secret-change-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }
  }

  if (errors.length > 0) {
    logger.error({ errors }, 'Configuration errors');
    if (config.isProduction) {
      process.exit(1);
    } else {
      logger.warn('Continuing in development mode with missing configuration...');
    }
  }
}
