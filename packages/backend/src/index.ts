// Domain Backend entry point
// TODO: Implement Apollo Server with MongoDB

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { readFileSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

import { resolvers } from './graphql/resolvers.js';
import { verifyJwt, extractTokenFromHeader } from './services/auth.js';
import { config, validateConfig } from './config/index.js';

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
    context: async ({ req }) => {
      const auth = req.headers.authorization as string | undefined;
      const token = extractTokenFromHeader(auth);
      const user = token ? verifyJwt(token) : null;
      return { user };
    },
  });

  console.log(`Domain Backend running at ${url}`);
}

main().catch(console.error);
