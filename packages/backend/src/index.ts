// Domain Backend entry point
// TODO: Implement Apollo Server with MongoDB

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import { readFileSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

import { resolvers } from './graphql/resolvers.js';
import { extractTokenFromHeader, extractTenantContext } from './services/auth.js';
import { config, validateConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import {
  closeTenantDbs,
  disconnectFromDatabase,
  getTenantDb,
  initializeTenantIndexes,
} from './db/connection.js';
import { getRegistryDb, ensureRegistryIndexes } from './db/registry.js';
import type { GraphQLContext } from './types/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: resolve(__dirname, '../../../.env'), debug: true });

// Validate configuration after dotenv loads
validateConfig();

const runtimeEnv = {
  LOG_LEVEL: process.env.LOG_LEVEL ?? '(unset)',
  NODE_ENV: process.env.NODE_ENV ?? '(unset)',
  ENABLE_PRETTY_LOGS: process.env.ENABLE_PRETTY_LOGS ?? '(unset)',
};

logger.info({ env: runtimeEnv }, 'Backend runtime environment');

async function main() {
  const typeDefs = readFileSync(join(__dirname, './schema.graphql'), 'utf-8');

  // Ensure registry indexes exist before serving requests
  await ensureRegistryIndexes();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: !config.isProduction,
    plugins: config.isProduction ? [ApolloServerPluginLandingPageDisabled()] : [],
  });

  // Start Apollo server
  await server.start();

  // Create Express app with Apollo middleware
  const app = express();

  // Health check endpoint for Kubernetes probes
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  // Apollo GraphQL middleware
  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }): Promise<GraphQLContext> => {
        const auth = req.headers.authorization as string | undefined;
        const token = extractTokenFromHeader(auth);
        const tenantCtx = extractTenantContext(token ?? undefined);

        let db = null;
        let registryDb = null;

        // If we have a valid tenant context, get the database connections
        if (tenantCtx?.tenantId) {
          try {
            [db, registryDb] = await Promise.all([
              getTenantDb(tenantCtx.tenantId),
              getRegistryDb(),
            ]);

            // Initialize indexes for this tenant database (blocking to ensure indexes exist before queries)
            if (db) {
              await initializeTenantIndexes(db, tenantCtx.tenantId);
            }
          } catch (error) {
            logger.error({ err: error }, 'Failed to get database connections');
            // Continue without db/registryDb - resolvers should handle gracefully
          }
        }

        return {
          userId: tenantCtx?.userId ?? null,
          username: tenantCtx?.username ?? null,
          avatarUrl: tenantCtx?.avatarUrl ?? null,
          tenantId: tenantCtx?.tenantId ?? null,
          tenantRole: tenantCtx?.tenantRole ?? null,
          githubLogin: tenantCtx?.githubLogin ?? null,
          db: db ?? undefined,
          registryDb: registryDb ?? undefined,
        };
      },
    })
  );

  // Start server
  await new Promise<void>((resolve) => {
    app.listen({ port: config.port, host: '0.0.0.0' }, () => {
      logger.info({ port: config.port }, 'Domain Backend running');
      resolve();
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, 'Shutting down backend...');
    try {
      await server.stop();
      await disconnectFromDatabase();
      await closeTenantDbs();
      logger.info('Backend shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during backend shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error({ err }, 'Backend failed to start');
});
