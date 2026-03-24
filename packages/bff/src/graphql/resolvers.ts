// BFF GraphQL resolvers — Auth, session, and tenant management only.
// Domain queries (records, scanBarcode, etc.) are handled by the stitched backend schema.

import { parse } from 'graphql';
import { logger } from '../utils/logger.js';
import type { GraphQLContext } from '../types/context.js';
import { getAvailableTenants, setActiveTenant, setAvailableTenants, DEFAULT_USER_SETTINGS } from '../types/session.js';
import type { UserSettings, AvailableTenant } from '../types/session.js';
import { getFeatureFlags } from '../utils/featureFlags.js';
import { lookupSpotifyPreview } from '../services/spotify.js';
import { backendExecutor } from './executor.js';

const UPDATE_USER_SETTINGS_MUTATION = parse(`
  mutation BffUpdateUserSettings($input: UpdateUserSettingsInput!) {
    updateUserSettings(input: $input) {
      id
      settings {
        spotifyPreview
        allowFriendInvites
      }
    }
  }
`);

const RESPOND_TO_FRIEND_REQUEST_MUTATION = parse(`
  mutation BffRespondToFriendRequest($requestId: ID!, $accept: Boolean!) {
    respondToFriendRequest(requestId: $requestId, accept: $accept)
  }
`);

const REMOVE_FRIEND_MUTATION = parse(`
  mutation BffRemoveFriend($friendId: ID!) {
    removeFriend(friendId: $friendId)
  }
`);

const GET_USER_TENANTS_QUERY = parse(`
  query BffGetUserTenants($userId: ID!) {
    userTenants(userId: $userId) {
      tenantId
      tenantType
      name
      role
    }
  }
`);

async function refreshSessionTenants(context: GraphQLContext): Promise<void> {
  if (!context.user) return;
  const result = (await backendExecutor({
    document: GET_USER_TENANTS_QUERY,
    variables: { userId: context.user.id },
    context,
  })) as { data?: { userTenants: AvailableTenant[] } };

  if (result.data?.userTenants) {
    setAvailableTenants(context.session, result.data.userTenants);
    await new Promise<void>((resolve, reject) => {
      context.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

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
      let availableTenants = getAvailableTenants(context.session) || [];
      let targetTenant = availableTenants.find((t) => t.tenantId === tenantId);

      // Lazily refresh session tenants in case a new friendship was established
      // by another user since this session was last populated.
      if (!targetTenant) {
        await refreshSessionTenants(context);
        availableTenants = getAvailableTenants(context.session) || [];
        targetTenant = availableTenants.find((t) => t.tenantId === tenantId);
      }

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

    updateUserSettings: async (
      _parent: unknown,
      _args: { input: { spotifyPreview?: boolean; allowFriendInvites?: boolean } },
      context: GraphQLContext
    ) => {
      if (!context.user || !context.session) {
        throw new Error('Unauthorized: user not authenticated');
      }

      // Delegate to backend (JWT is injected by executor from context.jwt)
      const result = await backendExecutor({
        document: UPDATE_USER_SETTINGS_MUTATION,
        variables: { input: _args.input },
        context,
      }) as { data?: { updateUserSettings?: { settings?: UserSettings } }; errors?: { message: string }[] };

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      const updatedSettings: UserSettings = {
        ...DEFAULT_USER_SETTINGS,
        ...(result.data?.updateUserSettings?.settings ?? {}),
      };

      // Keep session in sync so /auth/me returns fresh settings immediately
      (context.session as any).user = {
        ...(context.session as any).user,
        settings: updatedSettings,
      };

      await new Promise<void>((resolve, reject) => {
        context.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info({ userId: context.user!.id, settings: updatedSettings }, 'User settings updated');

      return {
        __typename: 'User',
        id: context.user.id,
        githubLogin: context.user.githubLogin,
        displayName: context.user.displayName,
        avatarUrl: context.user.avatarUrl || null,
        settings: updatedSettings,
        createdAt: context.user.createdAt,
        updatedAt: context.user.updatedAt,
      };
    },

    respondToFriendRequest: async (
      _parent: unknown,
      _args: { requestId: string; accept: boolean },
      context: GraphQLContext
    ) => {
      if (!context.user || !context.session) {
        throw new Error('Unauthorized: user not authenticated');
      }

      const result = await backendExecutor({
        document: RESPOND_TO_FRIEND_REQUEST_MUTATION,
        variables: { requestId: _args.requestId, accept: _args.accept },
        context,
      }) as { data?: { respondToFriendRequest?: boolean }; errors?: { message: string }[] };

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      // Refresh session available tenants (accepting adds the requester's tenant)
      await refreshSessionTenants(context);

      logger.info(
        { userId: context.user.id, requestId: _args.requestId, accept: _args.accept },
        'Responded to friend request'
      );
      return true;
    },

    removeFriend: async (
      _parent: unknown,
      _args: { friendId: string },
      context: GraphQLContext
    ) => {
      if (!context.user || !context.session) {
        throw new Error('Unauthorized: user not authenticated');
      }

      const result = await backendExecutor({
        document: REMOVE_FRIEND_MUTATION,
        variables: { friendId: _args.friendId },
        context,
      }) as { data?: { removeFriend?: boolean }; errors?: { message: string }[] };

      if (result.errors?.length) {
        throw new Error(result.errors[0].message);
      }

      // Refresh session available tenants (friend's tenant is removed)
      await refreshSessionTenants(context);

      logger.info({ userId: context.user.id, friendId: _args.friendId }, 'Removed friend');
      return true;
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
