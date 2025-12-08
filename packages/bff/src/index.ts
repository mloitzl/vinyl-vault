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
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';

import { config, validateConfig } from './config/env.js';
import { connectToDatabase } from './db/connection.js';
import { authRouter } from './auth/index.js';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';
import type { GraphQLContext } from './types/context.js';
import './types/session.js'; // Import session types
import { getActiveTenant } from './types/session.js';

async function main() {
  // Validate configuration
  validateConfig();

  // Connect to MongoDB
  await connectToDatabase();

  const app = express();

  // Trust proxy for secure cookies behind reverse proxy
  app.set('trust proxy', 1);

  // CORS configuration
  // In development allow requests from any origin (so frontend started with --host is reachable).
  // In production restrict to the configured frontend URL.
  app.use(
    cors({
      origin: config.isProduction ? config.frontend.url : true,
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json());

  // Session middleware with MongoDB store
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
        sameSite: config.isProduction ? 'strict' : 'lax',
        maxAge: config.session.maxAge,
      },
    })
  );

  // Auth routes
  app.use('/auth', authRouter);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Initialize Apollo Server
  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
  });

  await server.start();

  // GraphQL middleware
  app.use(
    '/graphql',
    expressMiddleware(server, {
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
  app.listen(config.port, host, () => {
    console.log(`BFF server running on http://${host}:${config.port}`);
    console.log(`GraphQL endpoint: http://${host}:${config.port}/graphql`);
    console.log(`Auth endpoint: http://${host}:${config.port}/auth/github`);
  });
}

main().catch(console.error);
