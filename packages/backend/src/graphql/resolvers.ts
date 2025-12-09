// Domain Backend GraphQL resolvers

import { upsertReleases, findReleasesByBarcode } from '../services/releasesCache.js';
import { findUserById, upsertUser, updateUserRole } from '../services/users.js';
import { lookupAndScoreBarcode } from '../services/scoring/index.js';
import {
  createPersonalTenant,
  createOrganizationTenant,
  addUserToTenant,
  getUserTenants,
} from '../services/tenants.js';
import {
  deleteInstallationFromEvent,
  upsertInstallationFromEvent,
  getInstallationById,
  linkUserToInstallation,
  waitForInstallation,
} from '../services/installations.js';
import { requireMember, requireAdmin, canRead } from '../utils/authorization.js';
import { verifyWebhookSignature } from '../utils/githubWebhook.js';
import type { Album, RawRelease, ScoringDetail } from '../services/scoring/types.js';
import type { GraphQLContext } from '../types/context.js';
import { ObjectId } from 'mongodb';

export const resolvers = {
  Query: {
    user: async (_parent: unknown, _args: { id: string }) => {
      return findUserById(_args.id);
    },
    record: async (_parent: unknown, _args: { id: string }) => {
      // TODO: Fetch record from MongoDB
      return null;
    },
    release: async (_parent: unknown, _args: { id: string }) => {
      // TODO: Fetch release from MongoDB
      return null;
    },
    releasesByBarcode: async (_parent: unknown, _args: { barcode: string }) => {
      // TODO: Search releases by barcode
      return [];
    },
    records: async (_parent: unknown, _args: unknown) => {
      // TODO: Paginated record query
      return { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false }, totalCount: 0 };
    },
    userTenants: async (_parent: unknown, _args: { userId: string }) => {
      const { userId } = _args;

      // Convert userId string to ObjectId
      let userObjId;
      try {
        userObjId = new ObjectId(userId);
      } catch {
        throw new Error(`Invalid userId: ${userId}`);
      }

      const tenants = await getUserTenants(userObjId);

      // Convert to GraphQL format
      return tenants.map((tenant) => ({
        userId: tenant.userId.toString(),
        tenantId: tenant.tenantId,
        role: tenant.role,
        tenantType: tenant.tenantType,
        name: tenant.name,
        databaseName: tenant.databaseName,
        createdAt: tenant.createdAt.toISOString(),
      }));
    },
  },
  Mutation: {
    lookupBarcode: async (
      _parent: unknown,
      _args: { barcode: string },
      context: GraphQLContext
    ) => {
      const { barcode } = _args;

      // Verify user has read access (all roles can read)
      if (!canRead(context)) {
        throw new Error('Unauthorized: user not authenticated');
      }

      if (!barcode) {
        return {
          albums: [],
          releases: [],
          fromCache: false,
          timing: null,
          errors: ['Barcode is required'],
        };
      }

      // Cache check disabled for now; we always fetch fresh so albums are populated.

      // Use the new blended scoring orchestrator
      const result = await lookupAndScoreBarcode(barcode);

      console.log(
        `[lookupBarcode] Got ${result.albums.length} albums, ${result.rawReleases.length} raw releases`
      );

      // Build a lookup map from rawReleases by id (format: SOURCE:externalId)
      const releaseMap = new Map<string, RawRelease>();
      for (const raw of result.rawReleases) {
        releaseMap.set(raw.id, raw);
      }

      // Build scoring details map for score breakdowns
      const scoringMap = new Map<string, ScoringDetail>();
      for (const detail of result.scoringDetails) {
        scoringMap.set(detail.releaseId, detail);
      }

      // Convert albums to GraphQL format
      const albums = result.albums.map((album: Album) => {
        // Find the primary release from rawReleases
        const primaryRaw = releaseMap.get(album.primaryReleaseId);
        const primaryScoring = scoringMap.get(album.primaryReleaseId);

        return {
          id: album.id,
          artist: album.artist,
          title: album.title,
          barcodes: [album.barcode], // Currently single barcode
          primaryRelease: primaryRaw
            ? {
                release: toGraphQLRelease(primaryRaw, barcode),
                score: album.primaryReleaseScore,
                scoreBreakdown: primaryScoring
                  ? {
                      mediaType: primaryScoring.mediaTypeScore,
                      countryPreference: primaryScoring.countryScore,
                      trackListCompleteness: primaryScoring.completenessScore,
                      coverArt: 0, // Not tracked separately in ScoringDetail
                      labelInfo: 0,
                      catalogNumber: 0,
                      yearInfo: 0,
                      sourceBonus: 0,
                    }
                  : null,
              }
            : null,
          alternativeReleases: album.alternativeReleases.map((alt) => ({
            externalId: alt.externalId,
            source: alt.source.toUpperCase(),
            country: alt.country,
            year: alt.year,
            format: null, // Not available in AlternativeRelease type
            label: alt.label,
            score: alt.score,
            editionNote: alt.disambiguation || null,
          })),
          trackList: album.trackList,
          genres: album.genres,
          styles: album.styles,
          externalIds: {
            discogs: album.discogsIds,
            musicbrainz: album.musicbrainzIds,
          },
          coverImageUrl: album.coverImageUrl,
          otherTitles: album.otherTitles,
          editionNotes: album.editionNotes,
          releaseCount: album.alternativeReleases.length + 1,
          score: album.primaryReleaseScore,
        };
      });

      // Build legacy releases array for backward compatibility
      const releases = result.rawReleases.map((raw: RawRelease) => toGraphQLRelease(raw, barcode));

      // Persist fetched results to cache (best-effort, use tenant database)
      if (releases.length > 0 && context.db) {
        try {
          await upsertReleases(context.db, releases as any);
        } catch (err: any) {
          console.warn('Failed to upsert releases cache:', err?.message ?? String(err));
        }
      }

      return {
        albums,
        releases,
        fromCache: false,
        timing: {
          discogsMs: 0, // TODO: Track individual API timings
          musicbrainzMs: 0,
          scoringMs: 0,
          totalMs: result.processingTimeMs,
        },
        errors: result.errors,
      };
    },
    createRecord: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      // Require MEMBER or ADMIN role to create records
      requireMember(context);

      if (!context.db) {
        throw new Error('Tenant database connection not available');
      }

      // TODO: Create record in tenant database (context.db)
      throw new Error('Not implemented');
    },
    updateRecord: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      // Require MEMBER or ADMIN role to update records
      requireMember(context);

      if (!context.db) {
        throw new Error('Tenant database connection not available');
      }

      // TODO: Update record in tenant database (context.db)
      throw new Error('Not implemented');
    },
    deleteRecord: async (_parent: unknown, _args: { id: string }, context: GraphQLContext) => {
      // Require MEMBER or ADMIN role to delete records
      requireMember(context);

      if (!context.db) {
        throw new Error('Tenant database connection not available');
      }

      // TODO: Delete record from tenant database (context.db)
      throw new Error('Not implemented');
    },
    upsertUser: async (
      _parent: unknown,
      _args: {
        input: {
          githubId: string;
          githubLogin: string;
          displayName: string;
          avatarUrl?: string;
          email?: string;
        };
      }
    ) => {
      return upsertUser(_args.input);
    },
    updateUserRole: async (
      _parent: unknown,
      _args: { userId: string; role: 'ADMIN' | 'CONTRIBUTOR' | 'READER' }
    ) => {
      const user = await updateUserRole(_args.userId, _args.role);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    },
    handleGitHubInstallationWebhook: async (
      _parent: unknown,
      _args: { input: { payloadBase64: string; signature: string } }
    ) => {
      const { payloadBase64, signature } = _args.input;
      const payloadBuffer = Buffer.from(payloadBase64, 'base64');

      if (!verifyWebhookSignature(payloadBuffer, signature)) {
        throw new Error('Invalid webhook signature');
      }

      let event: any;
      try {
        event = JSON.parse(payloadBuffer.toString('utf8'));
      } catch (error) {
        throw new Error(`Invalid webhook payload: ${(error as Error)?.message ?? 'parse error'}`);
      }

      if (event?.installation) {
        if (event.action === 'created') {
          await upsertInstallationFromEvent(event);
        } else if (event.action === 'deleted') {
          await deleteInstallationFromEvent(event);
        }
      }

      return { ok: true, message: 'Webhook processed' };
    },
    completeInstallationSetup: async (
      _parent: unknown,
      _args: { input: { userId: string; installationId: number; setupAction?: string } }
    ) => {
      const { userId, installationId } = _args.input;

      console.log(
        `[completeInstallationSetup] User ${userId} setting up installation ${installationId}`
      );

      // 1. Verify installation exists
      // Webhook can arrive slightly after the user is redirected here; wait briefly.
      const installation = await waitForInstallation(installationId, 6000, 400);
      if (!installation) {
        throw new Error(`Installation ${installationId} not found`);
      }

      // 2. Get user ObjectId
      let userObjId;
      try {
        userObjId = new ObjectId(userId);
      } catch {
        throw new Error(`Invalid userId: ${userId}`);
      }

      // 3. Link user to installation
      await linkUserToInstallation(userObjId, installationId, 'ADMIN');

      // 4. Create organization tenant
      // Tenant ID: org_{account_id}_{installation_id}
      // For simplicity, use org_{installation_id} or org_{accountLogin}_{installationId}
      const accountId = installation.account_id || installation.account_login;
      const tenantName = installation.account_login;

      // Check if tenant already exists
      const existingTenant = await createOrganizationTenant(
        accountId,
        tenantName,
        installation.account_login
      );

      // 5. Add user as ADMIN to the new org tenant
      await addUserToTenant(userObjId, existingTenant.tenantId, 'ADMIN');

      console.log(`[completeInstallationSetup] Created org tenant ${existingTenant.tenantId}`);

      return {
        ok: true,
        tenantId: existingTenant.tenantId,
        tenantName: existingTenant.name,
        message: `Organization ${tenantName} added successfully`,
      };
    },
    createTenant: async (
      _parent: unknown,
      _args: {
        input: {
          tenantType: 'USER' | 'ORGANIZATION';
          name: string;
          githubOrgId?: string;
          githubOrgName?: string;
        };
      },
      context: GraphQLContext
    ) => {
      // Verify user is authenticated
      if (!context.userId) {
        throw new Error('Unauthorized: user not authenticated');
      }

      // For ORGANIZATION tenants, require ADMIN role
      if (_args.input.tenantType === 'ORGANIZATION') {
        requireAdmin(context);
      }

      const { tenantType, name, githubOrgId, githubOrgName } = _args.input;

      let tenant;

      if (tenantType === 'USER') {
        // For USER tenants, only the user can create their own personal tenant
        const userObjId = new ObjectId(context.userId);
        tenant = await createPersonalTenant(userObjId, name);

        // Automatically add the user to their personal tenant with ADMIN role
        await addUserToTenant(userObjId, tenant.tenantId, 'ADMIN');
      } else if (tenantType === 'ORGANIZATION') {
        // For ORGANIZATION tenants, require GitHub org details
        if (!githubOrgId) {
          throw new Error('githubOrgId is required for ORGANIZATION tenants');
        }
        tenant = await createOrganizationTenant(githubOrgId, name, githubOrgName);

        // Automatically add the creator to the org tenant with ADMIN role
        const userObjId = new ObjectId(context.userId);
        await addUserToTenant(userObjId, tenant.tenantId, 'ADMIN');
      } else {
        throw new Error(`Invalid tenantType: ${tenantType}`);
      }

      // Convert to GraphQL format
      return {
        tenantId: tenant.tenantId,
        tenantType: tenant.tenantType,
        name: tenant.name,
        databaseName: tenant.databaseName,
        createdAt: tenant.createdAt.toISOString(),
      };
    },
    addUserToTenant: async (
      _parent: unknown,
      _args: { userId: string; tenantId: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' },
      context: GraphQLContext
    ) => {
      // Require ADMIN role to add users to tenant
      requireAdmin(context);

      if (!context.userId) {
        throw new Error('Unauthorized: user not authenticated');
      }

      const { userId, tenantId, role } = _args;

      // Convert userId string to ObjectId
      let userObjId;
      try {
        userObjId = new ObjectId(userId);
      } catch {
        throw new Error(`Invalid userId: ${userId}`);
      }

      const userTenantRole = await addUserToTenant(userObjId, tenantId, role);

      // Convert to GraphQL format
      return {
        userId: userTenantRole.userId.toString(),
        tenantId: userTenantRole.tenantId,
        role: userTenantRole.role,
        createdAt: userTenantRole.createdAt.toISOString(),
      };
    },
  },
  User: {
    records: async (_parent: { id: string }) => {
      // TODO: Fetch user's records
      return [];
    },
  },
  Record: {
    release: async (_parent: { releaseId: string }) => {
      // TODO: Fetch associated release
      return null;
    },
    owner: async (_parent: { userId: string }) => {
      // TODO: Fetch owner user
      return null;
    },
  },
};

/**
 * Convert a RawRelease to the GraphQL Release format.
 */
function toGraphQLRelease(release: RawRelease, barcode: string) {
  const now = new Date().toISOString();
  const source = release.source.toUpperCase();
  return {
    id: `${source}:${release.externalId}`,
    barcode,
    artist: release.artist,
    title: release.title,
    year: release.year,
    format: release.format,
    genre: release.genre || [],
    style: release.style || [],
    label: release.label,
    country: release.country,
    coverImageUrl: release.coverImageUrl,
    trackList: release.trackList || [],
    externalId: release.externalId,
    source,
    createdAt: now,
    updatedAt: now,
  };
}
