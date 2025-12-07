// Environment configuration
// Centralized environment variable access with validation

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
    },

    // External APIs
    discogs: {
      apiToken: process.env.DISCOGS_API_TOKEN || '',
    },

    musicbrainz: {
      userAgent: process.env.MUSICBRAINZ_USER_AGENT || 'VinylVault/0.1.0 (example@example.com)',
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

  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach((err) => console.error(`  - ${err}`));
    if (config.isProduction) {
      process.exit(1);
    } else {
      console.warn('Continuing in development mode with missing configuration...');
    }
  }
}
