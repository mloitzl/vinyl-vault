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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: resolve(__dirname, '../../../.env'), debug: true });

const PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);

async function main() {
  const typeDefs = readFileSync(join(__dirname, './schema.graphql'), 'utf-8');

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: PORT },
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
