// BFF GraphQL resolvers

import type { GraphQLContext } from '../types/context.js';
import { signJwt } from '../auth/jwt.js';
import { queryBackend } from '../services/backendClient.js';
import { getAvailableTenants, setActiveTenant } from '../types/session.js';

export const resolvers = {
  Query: {
    viewer: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      // Verify user is authenticated
      if (!context.user) {
        return null;
      }

      // Get available tenants from session (populated at login)
      const availableTenants = getAvailableTenants(context.session) || [];

      // Get active tenant from session
      const activeTenantId = context.activeTenantId;
      const activeTenant = availableTenants.find((t) => t.tenantId === activeTenantId);

      return {
        __typename: 'User',
        id: context.user.id,
        githubLogin: context.user.githubLogin,
        displayName: context.user.displayName,
        avatarUrl: context.user.avatarUrl || null,
        availableTenants: availableTenants.map((t) => ({
          __typename: 'Tenant',
          id: t.tenantId,
          name: t.name,
          type: t.tenantType,
          role: t.role,
        })),
        activeTenant: activeTenant
          ? {
              __typename: 'Tenant',
              id: activeTenant.tenantId,
              name: activeTenant.name,
              type: activeTenant.tenantType,
              role: activeTenant.role,
            }
          : null,
        createdAt: context.user.createdAt,
        updatedAt: context.user.updatedAt,
      };
    },
    node: async (_parent: unknown, _args: { id: string }, _context: GraphQLContext) => {
      // TODO: Implement node query for Relay
      return null;
    },
    records: async (
      _parent: unknown,
      _args: {
        first?: number;
        after?: string;
        last?: number;
        before?: string;
        filter?: {
          artist?: string;
          title?: string;
          year?: number;
          format?: string;
          location?: string;
          search?: string;
        };
      },
      context: GraphQLContext
    ) => {
      // Verify user is authenticated
      if (!context.user) {
        return {
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
          totalCount: 0,
        };
      }

      // Get active tenant
      const availableTenants = getAvailableTenants(context.session) || [];
      const activeTenant = availableTenants.find((t) => t.tenantId === context.activeTenantId);

      if (!activeTenant) {
        return {
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
          totalCount: 0,
        };
      }

      // Create JWT with tenant context
      const jwt = signJwt({
        sub: context.user.id,
        username: context.user.displayName || context.user.githubLogin,
        avatarUrl: context.user.avatarUrl,
        tenantId: activeTenant.tenantId,
        tenantRole: activeTenant.role,
        githubLogin: context.user.githubLogin,
      });

      // Proxy to backend
      const query = `query Records($first: Int, $after: String, $filter: RecordFilter) {
        records(first: $first, after: $after, filter: $filter) {
          edges {
            cursor
            node {
              id
              purchaseDate
              price
              condition
              location
              notes
              createdAt
              updatedAt
              release {
                id
                barcode
                artist
                title
                year
                format
                genre
                style
                label
                country
                coverImageUrl
                externalId
                source
                trackList { position title duration }
              }
              owner {
                id
                githubLogin
                displayName
                avatarUrl
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
          totalCount
        }
      }`;

      try {
        const data = await queryBackend<{ records: any }>(
          query,
          { first: _args.first, after: _args.after, filter: _args.filter },
          { jwt }
        );
        return data.records;
      } catch (err: any) {
        console.error('[BFF] records query error:', err);
        return {
          edges: [],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
          totalCount: 0,
        };
      }
    },
  },
  Mutation: {
    scanBarcode: async (_parent: unknown, _args: { barcode: string }, _context: GraphQLContext) => {
      const { barcode } = _args;
      const ctx = _context;

      if (!barcode)
        return {
          albums: [],
          releases: [],
          fromCache: false,
          timing: null,
          errors: ['barcode is required'],
        };

      // If user is authenticated, create a short-lived JWT to call backend.
      // Otherwise call backend without JWT (backend may allow unauthenticated lookups depending on policy).
      let jwt = '';
      if (ctx.user) {
        const availableTenants = getAvailableTenants(ctx.session) || [];
        const activeTenant =
          availableTenants.find((t) => t.tenantId === ctx.activeTenantId) || availableTenants[0];
        const tenantId = activeTenant?.tenantId || `user_${ctx.user.id}`;
        const username = ctx.user.displayName || ctx.user.githubLogin;
        const tenantRole = activeTenant?.role || 'VIEWER';
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
            timing?: {
              discogsMs: number;
              musicbrainzMs: number;
              scoringMs: number;
              totalMs: number;
            };
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
        return {
          albums: [],
          releases: [],
          fromCache: false,
          timing: null,
          errors: [err?.message ?? String(err)],
        };
      }
    },
    createRecord: async (
      _parent: unknown,
      _args: {
        input: {
          releaseId: string;
          purchaseDate?: string;
          price?: number;
          condition?: string;
          location?: string;
          notes?: string;
        };
      },
      context: GraphQLContext
    ) => {
      // Verify user is authenticated
      if (!context.user) {
        return { record: null, errors: ['Unauthorized: user not authenticated'] };
      }

      // Get active tenant and role
      const availableTenants = getAvailableTenants(context.session) || [];
      const activeTenant = availableTenants.find((t) => t.tenantId === context.activeTenantId);

      if (!activeTenant) {
        return { record: null, errors: ['No active tenant selected'] };
      }

      // Verify user has MEMBER or ADMIN role
      if (activeTenant.role !== 'ADMIN' && activeTenant.role !== 'MEMBER') {
        return {
          record: null,
          errors: ['Unauthorized: MEMBER or ADMIN role required to create records'],
        };
      }

      // Create JWT with tenant context
      const jwt = signJwt({
        sub: context.user.id,
        username: context.user.displayName || context.user.githubLogin,
        avatarUrl: context.user.avatarUrl,
        tenantId: activeTenant.tenantId,
        tenantRole: activeTenant.role,
        githubLogin: context.user.githubLogin,
      });

      // Proxy to backend
      const mutation = `mutation CreateRecord($input: CreateRecordInput!) {
        createRecord(input: $input) {
          id
          purchaseDate
          price
          condition
          location
          notes
          createdAt
          updatedAt
          release {
            id
            barcode
            artist
            title
            year
            format
            genre
            style
            label
            country
            coverImageUrl
            externalId
            source
            trackList { position title duration }
          }
          owner {
            id
            githubLogin
            displayName
            avatarUrl
          }
        }
      }`;

      try {
        const data = await queryBackend<{ createRecord: any }>(
          mutation,
          { input: _args.input },
          { jwt }
        );
        return { record: data.createRecord, errors: [] };
      } catch (err: any) {
        console.error('[BFF] createRecord error:', err);
        return { record: null, errors: [err?.message ?? 'Failed to create record'] };
      }
    },
    updateRecord: async (
      _parent: unknown,
      _args: {
        input: {
          id: string;
          purchaseDate?: string;
          price?: number;
          condition?: string;
          location?: string;
          notes?: string;
        };
      },
      context: GraphQLContext
    ) => {
      // Verify user is authenticated
      if (!context.user) {
        return { record: null, errors: ['Unauthorized: user not authenticated'] };
      }

      // Get active tenant and role
      const availableTenants = getAvailableTenants(context.session) || [];
      const activeTenant = availableTenants.find((t) => t.tenantId === context.activeTenantId);

      if (!activeTenant) {
        return { record: null, errors: ['No active tenant selected'] };
      }

      // Verify user has MEMBER or ADMIN role
      if (activeTenant.role !== 'ADMIN' && activeTenant.role !== 'MEMBER') {
        return {
          record: null,
          errors: ['Unauthorized: MEMBER or ADMIN role required to update records'],
        };
      }

      // Create JWT with tenant context
      const jwt = signJwt({
        sub: context.user.id,
        username: context.user.displayName || context.user.githubLogin,
        avatarUrl: context.user.avatarUrl,
        tenantId: activeTenant.tenantId,
        tenantRole: activeTenant.role,
        githubLogin: context.user.githubLogin,
      });

      // Proxy to backend
      const mutation = `mutation UpdateRecord($input: UpdateRecordInput!) {
        updateRecord(input: $input) {
          id
          purchaseDate
          price
          condition
          location
          notes
          createdAt
          updatedAt
          release {
            id
            barcode
            artist
            title
            year
            format
            genre
            style
            label
            country
            coverImageUrl
            externalId
            source
            trackList { position title duration }
          }
          owner {
            id
            githubLogin
            displayName
            avatarUrl
          }
        }
      }`;

      try {
        const data = await queryBackend<{ updateRecord: any }>(
          mutation,
          { input: _args.input },
          { jwt }
        );
        return { record: data.updateRecord, errors: [] };
      } catch (err: any) {
        console.error('[BFF] updateRecord error:', err);
        return { record: null, errors: [err?.message ?? 'Failed to update record'] };
      }
    },
    deleteRecord: async (_parent: unknown, _args: { input: { id: string } }, context: GraphQLContext) => {
      // Verify user is authenticated
      if (!context.user) {
        return { deletedRecordId: null, errors: ['Unauthorized: user not authenticated'] };
      }

      // Get active tenant and role
      const availableTenants = getAvailableTenants(context.session) || [];
      const activeTenant = availableTenants.find((t) => t.tenantId === context.activeTenantId);

      if (!activeTenant) {
        return { deletedRecordId: null, errors: ['No active tenant selected'] };
      }

      // Verify user has MEMBER or ADMIN role (backend will verify ownership)
      if (activeTenant.role !== 'ADMIN' && activeTenant.role !== 'MEMBER') {
        return {
          deletedRecordId: null,
          errors: ['Unauthorized: MEMBER or ADMIN role required to delete records'],
        };
      }

      // Create JWT with tenant context
      const jwt = signJwt({
        sub: context.user.id,
        username: context.user.displayName || context.user.githubLogin,
        avatarUrl: context.user.avatarUrl,
        tenantId: activeTenant.tenantId,
        tenantRole: activeTenant.role,
        githubLogin: context.user.githubLogin,
      });

      // Proxy to backend
      const mutation = `mutation DeleteRecord($id: ID!) {
        deleteRecord(id: $id)
      }`;

      try {
        const data = await queryBackend<{ deleteRecord: boolean }>(
          mutation,
          { id: _args.input.id },
          { jwt }
        );
        if (data.deleteRecord) {
          return { deletedRecordId: _args.input.id, errors: [] };
        } else {
          return { deletedRecordId: null, errors: ['Failed to delete record'] };
        }
      } catch (err: any) {
        console.error('[BFF] deleteRecord error:', err);
        return { deletedRecordId: null, errors: [err?.message ?? 'Failed to delete record'] };
      }
    },
    switchTenant: async (
      _parent: unknown,
      _args: { tenantId: string },
      context: GraphQLContext
    ) => {
      // Verify user is authenticated
      if (!context.user || !context.session) {
        throw new Error('Unauthorized: user not authenticated');
      }

      const { tenantId } = _args;

      // Get available tenants from session
      const availableTenants = getAvailableTenants(context.session) || [];

      // Verify user has access to target tenant
      const targetTenant = availableTenants.find((t) => t.tenantId === tenantId);
      if (!targetTenant) {
        throw new Error(`Unauthorized: user does not have access to tenant ${tenantId}`);
      }

      // Update session active tenant
      setActiveTenant(context.session, tenantId);

      // Save session changes
      await new Promise<void>((resolve, reject) => {
        context.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`[resolvers] User switched to tenant: ${tenantId}`);

      // Return updated user with new active tenant
      return {
        __typename: 'User',
        id: context.user.id,
        githubLogin: context.user.githubLogin,
        displayName: context.user.displayName,
        avatarUrl: context.user.avatarUrl || null,
        availableTenants: availableTenants.map((t) => ({
          __typename: 'Tenant',
          id: t.tenantId,
          name: t.name,
          type: t.tenantType,
          role: t.role,
        })),
        activeTenant: targetTenant
          ? {
              __typename: 'Tenant',
              id: targetTenant.tenantId,
              name: targetTenant.name,
              type: targetTenant.tenantType,
              role: targetTenant.role,
            }
          : null,
        createdAt: context.user.createdAt,
        updatedAt: context.user.updatedAt,
      };
    },
  },
  Node: {
    __resolveType(obj: { __typename?: string }) {
      return obj.__typename || null;
    },
  },
};
