// Domain Backend entry point
// TODO: Implement Apollo Server with MongoDB

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

import { resolvers } from './graphql/resolvers.js';
import { extractTokenFromHeader, extractTenantContext } from './services/auth.js';
import { config, validateConfig } from './config/index.js';
import { getTenantDb } from './db/connection.js';
import { getRegistryDb } from './db/registry.js';
import type { GraphQLContext } from './types/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: resolve(__dirname, '../../../.env'), debug: true });

// Validate configuration after dotenv loads
validateConfig();

async function main() {
  const typeDefs = readFileSync(join(__dirname, './schema.graphql'), 'utf-8');

  const server = new ApolloServer({
    typeDefs,
    resolvers,
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
        } catch (error) {
          console.error('Failed to get database connections:', error);
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

  console.log(`Domain Backend running at ${url}`);
}


main().catch(console.error);
