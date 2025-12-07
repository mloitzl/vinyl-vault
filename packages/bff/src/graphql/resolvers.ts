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
        createdAt: context.user.createdAt,
        updatedAt: context.user.updatedAt,
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

      if (!barcode) return { albums: [], releases: [], fromCache: false, timing: null, errors: ['barcode is required'] };

      // If user is authenticated, create a short-lived JWT to call backend.
      // Otherwise call backend without JWT (backend may allow unauthenticated lookups depending on policy).
      let jwt = '';
      if (ctx.user) {
        const tenantId = ctx.activeTenantId || `user_${ctx.user.id}`;
        const username = ctx.user.displayName || ctx.user.githubLogin;
        const tenantRole =
          ctx.user.role === 'ADMIN'
            ? 'ADMIN'
            : ctx.user.role === 'CONTRIBUTOR'
            ? 'MEMBER'
            : 'VIEWER';
        jwt = signJwt({
          sub: ctx.user.id,
          username,
          avatarUrl: ctx.user.avatarUrl,
          tenantId,
          tenantRole,
          githubLogin: ctx.user.githubLogin,
        });
      }

      // Query backend for albums (blended scoring) and legacy releases
      const query = `mutation Lookup($barcode: String!) {
        lookupBarcode(barcode: $barcode) {
          albums {
            id
            artist
            title
            barcodes
            primaryRelease {
              release {
                id
                barcode
                artist
                title
                year
                format
                label
                country
                coverImageUrl
                externalId
                source
                genre
                style
                trackList { position title duration }
              }
              score
              scoreBreakdown {
                mediaType
                countryPreference
                trackListCompleteness
                coverArt
                labelInfo
                catalogNumber
                yearInfo
                sourceBonus
              }
            }
            alternativeReleases {
              externalId
              source
              country
              year
              format
              label
              score
              editionNote
            }
            trackList { position title duration }
            genres
            styles
            externalIds { discogs musicbrainz }
            coverImageUrl
            otherTitles
            editionNotes
            releaseCount
            score
          }
          releases {
            id
            barcode
            artist
            title
            year
            format
            label
            country
            coverImageUrl
            externalId
            source
            genre
            style
            trackList { position title duration }
          }
          fromCache
          timing { discogsMs musicbrainzMs scoringMs totalMs }
          errors
        }
      }`;

      try {
        const data = await queryBackend<{
          lookupBarcode: {
            albums: any[];
            releases: any[];
            fromCache: boolean;
            timing?: { discogsMs: number; musicbrainzMs: number; scoringMs: number; totalMs: number };
            errors?: string[];
          };
        }>(query, { barcode }, { jwt });
        const payload = data.lookupBarcode;
        return {
          albums: payload.albums || [],
          releases: payload.releases || [],
          fromCache: payload.fromCache || false,
          timing: payload.timing || null,
          errors: payload.errors || [],
        };
      } catch (err: any) {
        return { albums: [], releases: [], fromCache: false, timing: null, errors: [err?.message ?? String(err)] };
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
