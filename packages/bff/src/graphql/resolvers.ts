// BFF GraphQL resolvers

import type { GraphQLContext } from '../types/context.js';

export const resolvers = {
  Query: {
    viewer: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      // Return current user from session or null
      if (!context.user) {
        return null;
      }

      return {
        __typename: 'User',
        id: context.user.id,
        githubLogin: context.user.githubLogin,
        displayName: context.user.displayName,
        avatarUrl: context.user.avatarUrl || null,
        role: context.user.role,
        createdAt: new Date().toISOString(), // TODO: Get from DB
        updatedAt: new Date().toISOString(), // TODO: Get from DB
      };
    },
    node: async (_parent: unknown, _args: { id: string }, _context: GraphQLContext) => {
      // TODO: Implement node query for Relay
      return null;
    },
    records: async (_parent: unknown, _args: unknown, _context: GraphQLContext) => {
      // TODO: Proxy to backend and return paginated records
      return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false }, totalCount: 0 };
    },
  },
  Mutation: {
    scanBarcode: async (_parent: unknown, _args: { barcode: string }, _context: GraphQLContext) => {
      // TODO: Proxy to backend for barcode lookup
      return { releases: [], errors: [] };
    },
    createRecord: async (_parent: unknown, _args: unknown, _context: GraphQLContext) => {
      // TODO: Check role and proxy to backend
      return { record: null, errors: ['Not implemented'] };
    },
    updateRecord: async (_parent: unknown, _args: unknown, _context: GraphQLContext) => {
      // TODO: Check role and proxy to backend
      return { record: null, errors: ['Not implemented'] };
    },
    deleteRecord: async (_parent: unknown, _args: unknown, _context: GraphQLContext) => {
      // TODO: Check role and proxy to backend
      return { deletedRecordId: null, errors: ['Not implemented'] };
    },
  },
  Node: {
    __resolveType(obj: { __typename?: string }) {
      return obj.__typename || null;
    },
  },
};
