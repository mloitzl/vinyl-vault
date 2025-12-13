// Domain Backend entry point
// TODO: Implement Apollo Server with MongoDB

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { startStandaloneServer } from '@apollo/server/standalone';
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

  const { url } = await startStandaloneServer(server, {
    // bind to all interfaces so the backend is reachable from the LAN
    listen: { port: config.port, host: '0.0.0.0' },
    context: async ({ req }): Promise<GraphQLContext> => {
      const auth = req.headers.authorization as string | undefined;
      const token = extractTokenFromHeader(auth);
      const tenantCtx = extractTenantContext(token ?? undefined);

      let db = null;
      let registryDb = null;

      // If we have a valid tenant context, get the database connections
      if (tenantCtx?.tenantId) {
        try {
          [db, registryDb] = await Promise.all([getTenantDb(tenantCtx.tenantId), getRegistryDb()]);

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
  });

  logger.info({ url }, 'Domain Backend running');

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
