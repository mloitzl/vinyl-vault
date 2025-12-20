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
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';
import type { GraphQLContext } from './types/context.js';
import './types/session.js'; // Import session types
import { getActiveTenant } from './types/session.js';
import { verifyWebhookSignature, forwardWebhookToBackend } from './auth/webhook.js';
import { logger, httpLogger } from './utils/logger.js';

async function main() {
  // Validate configuration
  validateConfig();

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
    })
  );

  // Basic rate limiting for public-facing routes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
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
      },
    })
  );

  // Auth routes
  app.use('/auth', authLimiter, authRouter);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Initialize Apollo Server
  const apolloServer = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    introspection: !config.isProduction,
    plugins: config.isProduction ? [ApolloServerPluginLandingPageDisabled()] : [],
  });

  await apolloServer.start();

  // GraphQL middleware
  app.use(
    '/graphql',
    graphqlLimiter,
    expressMiddleware(apolloServer, {
      context: async ({ req, res }): Promise<GraphQLContext> => ({
        req: req as any,
        res,
        user: req.session.user || null,
        session: req.session,
        activeTenantId: getActiveTenant(req.session) ?? null,
      }),
    })
  );

  // Bind to all interfaces so the BFF is reachable from other devices on the LAN when running in dev.
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
});
