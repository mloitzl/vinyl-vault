// BFF GraphQL resolvers — Auth, session, and tenant management only.
// Domain queries (records, scanBarcode, etc.) are handled by the stitched backend schema.

import { logger } from '../utils/logger.js';
import type { GraphQLContext } from '../types/context.js';
import { getAvailableTenants, setActiveTenant } from '../types/session.js';
import { getFeatureFlags } from '../utils/featureFlags.js';
import { lookupSpotifyPreview } from '../services/spotify.js';

export const resolvers = {
  Query: {
    viewer: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.user) return null;

      return {
        __typename: 'User',
        id: context.user.id,
        githubLogin: context.user.githubLogin,
        displayName: context.user.displayName,
        avatarUrl: context.user.avatarUrl || null,
        createdAt: context.user.createdAt,
        updatedAt: context.user.updatedAt,
      };
    },

    spotifyPreview: async (
      _parent: unknown,
      args: { track: string; artist: string },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error('Unauthorized: user not authenticated');
      }

      const track = String(args.track ?? '').trim();
      const artist = String(args.artist ?? '').trim();

      return lookupSpotifyPreview(track, artist);
    },
  },

  Mutation: {
    switchTenant: async (
      _parent: unknown,
      _args: { tenantId: string },
      context: GraphQLContext
    ) => {
      if (!context.user || !context.session) {
        throw new Error('Unauthorized: user not authenticated');
      }

      const { tenantId } = _args;
      const availableTenants = getAvailableTenants(context.session) || [];
      const targetTenant = availableTenants.find((t) => t.tenantId === tenantId);
      if (!targetTenant) {
        throw new Error(`Unauthorized: user does not have access to tenant ${tenantId}`);
      }

      setActiveTenant(context.session, tenantId);

      await new Promise<void>((resolve, reject) => {
        context.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info({ userId: context.user!.id, tenantId }, 'User switched to tenant');

      return {
        __typename: 'User',
        id: context.user.id,
        githubLogin: context.user.githubLogin,
        displayName: context.user.displayName,
        avatarUrl: context.user.avatarUrl || null,
        createdAt: context.user.createdAt,
        updatedAt: context.user.updatedAt,
      };
    },
  },

  User: {
    availableTenants: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const tenants = getAvailableTenants(context.session) || [];
      return tenants.map((t) => ({
        __typename: 'Tenant',
        id: t.tenantId,
        name: t.name,
        type: t.tenantType,
        role: t.role,
      }));
    },

    activeTenant: (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const tenants = getAvailableTenants(context.session) || [];
      // Read directly from session so switchTenant updates are reflected immediately
      const activeTenantId = (context.session as any).activeTenantId ?? context.activeTenantId;
      const active = tenants.find((t) => t.tenantId === activeTenantId);
      if (!active) return null;
      return {
        __typename: 'Tenant',
        id: active.tenantId,
        name: active.name,
        type: active.tenantType,
        role: active.role,
      };
    },

    featureFlags: () => getFeatureFlags(),
  },
};
