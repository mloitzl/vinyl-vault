// BFF GraphQL resolvers

import type { GraphQLContext } from '../types/context.js';
import { signJwt } from '../auth/jwt.js';
import { queryBackend } from '../services/backendClient.js';

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
      const { barcode } = _args;
      const ctx = _context;

      if (!barcode) return { releases: [], errors: ['barcode is required'] };

      // If user is authenticated, create a short-lived JWT to call backend.
      // Otherwise call backend without JWT (backend may allow unauthenticated lookups depending on policy).
      let jwt = '';
      if (ctx.user) {
        jwt = signJwt({ sub: ctx.user.id, role: ctx.user.role, githubLogin: ctx.user.githubLogin });
      }

      const query = `mutation Lookup($barcode: String!) { lookupBarcode(barcode: $barcode) { releases { id barcode artist title year format label country coverImageUrl externalId source genre style trackList { position title duration } } fromCache errors } }`;

      try {
        const data = await queryBackend<{
          lookupBarcode: { releases: any[]; fromCache: boolean; errors?: string[] };
        }>(query, { barcode }, { jwt });
        const payload = data.lookupBarcode;
        return { releases: payload.releases || [], errors: payload.errors || [] };
      } catch (err: any) {
        return { releases: [], errors: [err?.message ?? String(err)] };
      }
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
