// Domain Backend entry point
// TODO: Implement Apollo Server with MongoDB

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';

const PORT = parseInt(process.env.BACKEND_PORT || '4000', 10);

async function main() {
  // TODO: Initialize MongoDB connection
  // TODO: Load type definitions and resolvers
  // TODO: Set up JWT validation context

  const server = new ApolloServer({
    typeDefs: `
      type Query {
        _placeholder: String
      }
    `,
    resolvers: {
      Query: {
        _placeholder: () => 'Backend server running',
      },
    },
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: PORT },
    // TODO: Add context function for JWT validation
  });

  console.log(`Domain Backend running at ${url}`);
}

main().catch(console.error);
