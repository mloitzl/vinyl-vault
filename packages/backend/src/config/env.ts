// Environment configuration
// Centralized environment variable access with validation

import { logger } from '../utils/logger.js';

// Use a getter function to ensure env vars are read after dotenv loads
function getConfig() {
  return {
    // Server
    port: parseInt(process.env.BACKEND_PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // JWT (for BFF to Backend communication)
    jwt: {
      secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    },

    // MongoDB
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/vinylvault',
      uriBase: process.env.MONGODB_URI_BASE || 'mongodb://localhost:27017',
      registryUri:
        process.env.MONGODB_REGISTRY_URI || 'mongodb://localhost:27017/vinylvault_registry',
    },

    // External APIs
    discogs: {
      apiToken: process.env.DISCOGS_API_TOKEN || '',
    },

    musicbrainz: {
      userAgent: process.env.MUSICBRAINZ_USER_AGENT || 'VinylVault/0.1.0 (example@example.com)',
    },

    github: {
      appWebhookSecret: process.env.GITHUB_APP_WEBHOOK_SECRET || '',
    },

    // Scoring
    scoring: {
      configPath: process.env.SCORING_CONFIG_PATH,
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

  if (config.isProduction) {
    if (config.jwt.secret === 'dev-jwt-secret-change-in-production') {
      errors.push('JWT_SECRET must be set in production');
    }
  }

  if (!config.github.appWebhookSecret) {
    errors.push('GITHUB_APP_WEBHOOK_SECRET is required to validate GitHub webhooks');
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
