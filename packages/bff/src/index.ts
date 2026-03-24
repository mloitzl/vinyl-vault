// BFF entry point
// Express + Apollo Server with GitHub OAuth

import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: resolve(__dirname, '../../../.env'), debug: true });

// Disable SSL verification in development (for corporate proxies/firewalls)
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import express from 'express';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { expressMiddleware } from '@apollo/server/express4';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';

import { config, validateConfig } from './config/env.js';
import { connectToDatabase, disconnectFromDatabase } from './db/connection.js';
import { authRouter } from './auth/index.js';
import { createStitchedSchema } from './graphql/schema.js';
import { createGraphqlTelemetryPlugin } from './graphql/telemetry.js';
import type { GraphQLContext } from './types/context.js';
import './types/session.js'; // Import session types
import { getActiveTenant, getAvailableTenants } from './types/session.js';
import { signJwt } from './auth/jwt.js';
import { verifyWebhookSignature, forwardWebhookToBackend } from './auth/webhook.js';
import { logger, httpLogger } from './utils/logger.js';

async function main() {
  // Validate configuration
  validateConfig();

  const runtimeEnv = {
    LOG_LEVEL: process.env.LOG_LEVEL ?? '(unset)',
    NODE_ENV: process.env.NODE_ENV ?? '(unset)',
    ENABLE_PRETTY_LOGS: process.env.ENABLE_PRETTY_LOGS ?? '(unset)',
  };

  logger.info({ env: runtimeEnv }, 'BFF runtime environment');

  // Connect to MongoDB
  await connectToDatabase();

  const app = express();

  // HTTP request logging (pretty in dev when ENABLE_PRETTY_LOGS=true)
  app.use(httpLogger);

  // Trust proxy for secure cookies behind reverse proxy
  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction
        ? undefined // rely on reverse proxy CSP if set; can be tuned later
        : false,
    })
  );

  // CORS configuration
  // In development allow requests from any origin (so frontend started with --host is reachable).
  // In production restrict to the configured frontend URL.
  app.use(
    cors({
      origin: config.isProduction ? config.frontend.url : true,
      credentials: true,
      // Allow W3C Trace Context headers so the browser can propagate the
      // distributed trace ID from the frontend to the BFF.
      allowedHeaders: ['Content-Type', 'Authorization', 'traceparent', 'tracestate'],
    })
  );

  // Basic rate limiting for public-facing routes
  // OAuth endpoints: strict — these trigger GitHub API calls and session writes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  // /auth/me: generous — it's a single MongoDB session read on every page load
  const sessionCheckLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  const graphqlLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 400,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  app.use(cookieParser());

  // GitHub webhook endpoint (raw body needed for signature validation)
  app.post('/webhook/github', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.header('x-hub-signature-256') as string | undefined;
      const payloadBuffer = req.body as Buffer;

      if (!verifyWebhookSignature(payloadBuffer, signature)) {
        logger.warn('Webhook invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const result = await forwardWebhookToBackend(payloadBuffer, signature ?? '');

      return res.json({ ok: true, backend: result });
    } catch (error) {
      logger.error({ err: error }, 'Error handling GitHub webhook');
      return res.status(500).json({ error: 'Internal server error' });
    }
  });
  app.use(express.json());

  // Session middleware with MongoDB store
  // Main session cookie: SameSite=strict (secure by default), carries user auth state
  app.use(
    session({
      name: config.session.cookieName,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl: config.mongodb.uri,
        collectionName: 'sessions',
        ttl: config.session.maxAge / 1000, // TTL in seconds
      }),
      cookie: {
        httpOnly: true,
        secure: config.isProduction,
        // Lax is required so the GitHub App installation redirect (cross-site)
        // can carry the session cookie; Strict would drop the cookie.
        sameSite: 'lax' as const,
        maxAge: config.session.maxAge,
        // When COOKIE_DOMAIN is set (e.g. '.vinylvault.example.com'), the cookie
        // is shared across subdomains so the frontend (Vercel) and API (Koyeb)
        // can share the same session.
        ...(config.session.cookieDomain ? { domain: config.session.cookieDomain } : {}),
      },
    })
  );

  // Auth routes — apply rate limiters per endpoint sensitivity:
  //   /auth/github* + /auth/logout + /auth/setup  → strict (OAuth flow, session mutation)
  //   /auth/me                                    → generous (single MongoDB session read)
  app.use(
    '/auth',
    (req, _res, next) => {
      if (req.path.startsWith('/github') || req.path === '/logout' || req.path === '/setup') {
        return authLimiter(req, _res, next);
      }
      if (req.path === '/me') {
        return sessionCheckLimiter(req, _res, next);
      }
      next();
    },
    authRouter
  );

  // Bind early so the health/readiness probe responds during schema stitching.
  // The /graphql route is wired up after stitching completes.
  let graphqlReady = false;
  const host = '0.0.0.0';
  const httpServer = app.listen(config.port, host, () => {
    logger.info(
      {
        port: config.port,
        graphqlEndpoint: `/graphql`,
        authEndpoint: `/auth/github`,
      },
      'BFF server running'
    );
  });

  // Health check — always responds so k8s liveness probe never times out.
  // Readiness check — returns 503 until the stitched schema is ready,
  // preventing traffic from being routed to the pod before GraphQL is available.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  app.get('/ready', (_req, res) => {
    if (graphqlReady) {
      res.json({ status: 'ok' });
    } else {
      res.status(503).json({ status: 'starting' });
    }
  });

  // Initialize Apollo Server using the stitched schema built from the static backend SDL.
  const schema = await createStitchedSchema();
  const apolloServer = new ApolloServer<GraphQLContext>({
    schema,
    introspection: !config.isProduction,
    plugins: [
      createGraphqlTelemetryPlugin(),
      ...(config.isProduction ? [ApolloServerPluginLandingPageDisabled()] : []),
    ],
  });

  await apolloServer.start();

  // GraphQL middleware
  app.use(
    '/graphql',
    graphqlLimiter,
    expressMiddleware(apolloServer, {
      context: async ({ req, res }): Promise<GraphQLContext> => {
        const session = req.session;
        const user = session.user || null;
        const activeTenantId = getActiveTenant(session) ?? null;
        let jwt: string | undefined;
        if (user) {
          const availableTenants = getAvailableTenants(session) || [];
          const activeTenant =
            availableTenants.find((t) => t.tenantId === activeTenantId) || availableTenants[0];
          jwt = signJwt({
            sub: user.id,
            username: user.displayName || user.githubLogin,
            avatarUrl: user.avatarUrl,
            tenantId: activeTenant?.tenantId || `user_${user.id}`,
            tenantRole: activeTenant?.role || 'VIEWER',
            githubLogin: user.githubLogin,
          });
        }
        return { req: req as any, res, user, session, activeTenantId, jwt };
      },
    })
  );

  // GraphQL is now fully wired — signal readiness probe
  graphqlReady = true;

  // Graceful shutdown
  const shutdown = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, 'Shutting down BFF...');
    try {
      await apolloServer.stop();
      await disconnectFromDatabase();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      logger.info('BFF shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during BFF shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'BFF failed to start');
  process.exit(1);
});
