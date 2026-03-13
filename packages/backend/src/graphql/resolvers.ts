// Domain Backend GraphQL resolvers

import { logger } from '../utils/logger.js';
import { upsertReleases } from '../services/releasesCache.js';
import { findUserById, upsertUser } from '../services/users.js';
import { lookupAndScoreBarcode } from '../services/scoring/index.js';
import {
  createRecord,
  findRecordById,
  findRecords,
  updateRecord,
  deleteRecord,
} from '../services/records.js';
import { ReleaseRepository } from '../models/release.js';
import {
  createPersonalTenant,
  createOrganizationTenant,
  addUserToTenant,
  ensureUserInTenant,
  getUserTenants,
} from '../services/tenants.js';
import {
  deleteInstallationFromEvent,
  upsertInstallationFromEvent,
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
    record: async (_parent: unknown, _args: { id: string }, context: GraphQLContext) => {
      // Verify user has read access
      if (!canRead(context)) {
        throw new Error('Unauthorized: user not authenticated');
      }

      if (!context.db) {
        throw new Error('Tenant database connection not available');
      }

      const record = await findRecordById(context.db, _args.id);
      if (!record) {
        return null;
      }

      return {
        id: record._id.toString(),
        releaseId: record.releaseId.toString(),
        userId: record.userId.toString(),
        purchaseDate: record.purchaseDate?.toISOString(),
        price: record.price,
        condition: record.condition,
        location: record.location,
        notes: record.notes,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      };
    },
    release: async (_parent: unknown, _args: { id: string }, context: GraphQLContext) => {
      // Verify user has read access
      if (!canRead(context)) {
        throw new Error('Unauthorized: user not authenticated');
      }

      if (!context.db) {
        throw new Error('Tenant database connection not available');
      }

      const releaseRepo = new ReleaseRepository(context.db);
      const release = await releaseRepo.findById(_args.id);

      if (!release) {
        return null;
      }

      return {
        id: release._id.toString(),
        barcode: release.barcode,
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
        source: release.source,
        createdAt:
          release.createdAt instanceof Date ? release.createdAt.toISOString() : release.createdAt,
        updatedAt:
          release.updatedAt instanceof Date ? release.updatedAt.toISOString() : release.updatedAt,
      };
    },
    releasesByBarcode: async (
      _parent: unknown,
      _args: { barcode: string },
      context: GraphQLContext
    ) => {
      // Verify user has read access
      if (!canRead(context)) {
        throw new Error('Unauthorized: user not authenticated');
      }

      if (!context.db) {
        throw new Error('Tenant database connection not available');
      }

      const releaseRepo = new ReleaseRepository(context.db);
      const releases = await releaseRepo.findByBarcode(_args.barcode);

      return releases.map((release) => ({
        id: release._id.toString(),
        barcode: release.barcode,
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
        source: release.source,
        createdAt:
          release.createdAt instanceof Date ? release.createdAt.toISOString() : release.createdAt,
        updatedAt:
          release.updatedAt instanceof Date ? release.updatedAt.toISOString() : release.updatedAt,
      }));
    },
    records: async (
      _parent: unknown,
      _args: { first?: number; after?: string; last?: number; before?: string; filter?: any },
      context: GraphQLContext
    ) => {
      // Verify user has read access
      if (!canRead(context)) {
        throw new Error('Unauthorized: user not authenticated');
      }

      if (!context.db) {
        throw new Error('Tenant database connection not available');
      }

      const filter = _args.filter || {};
      const pagination = { first: _args.first, after: _args.after, last: _args.last, before: _args.before };

      const result = await findRecords(context.db, filter, pagination);

      return {
        edges: result.edges.map((edge) => ({
          cursor: edge.cursor,
          node: {
            id: edge.node._id.toString(),
            releaseId: edge.node.releaseId.toString(),
            userId: edge.node.userId.toString(),
            purchaseDate: edge.node.purchaseDate?.toISOString(),
            price: edge.node.price,
            condition: edge.node.condition,
            location: edge.node.location,
            notes: edge.node.notes,
            createdAt: edge.node.createdAt.toISOString(),
            updatedAt: edge.node.updatedAt.toISOString(),
          },
        })),
        pageInfo: result.pageInfo,
        totalCount: result.totalCount,
      };
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

    artists: async (
      _parent: unknown,
      _args: { first?: number; after?: string; filter?: { search?: string } },
      context: GraphQLContext
    ) => {
      if (!canRead(context)) throw new Error('Unauthorized: user not authenticated');
      if (!context.db) throw new Error('Tenant database connection not available');

      const limit = Math.min(_args.first || 20, 100);
      const search = _args.filter?.search;

      // Base pipeline: join records → releases, filter by search, group by artist
      const searchMatchStage: Record<string, unknown> = {};
      if (search) {
        searchMatchStage['release.artist'] = { $regex: search, $options: 'i' };
      }

      const basePipeline: object[] = [
        {
          $lookup: {
            from: 'releases',
            localField: 'releaseId',
            foreignField: '_id',
            as: 'release',
          },
        },
        { $unwind: '$release' },
        ...(Object.keys(searchMatchStage).length ? [{ $match: searchMatchStage }] : []),
        {
          $group: {
            _id: '$release.artist',
            recordCount: { $sum: 1 },
            coverImageUrl: { $first: '$release.coverImageUrl' },
            genres: { $addToSet: '$release.genre' },
          },
        },
      ];

      // Cursor-based pagination applied after $group, decoded from base64
      const paginatedStages: object[] = [{ $sort: { _id: 1 } }];
      if (_args.after) {
        let afterName: string;
        try {
          afterName = Buffer.from(_args.after, 'base64').toString('utf8').replace(/^artist:/, '');
        } catch {
          throw new Error('Invalid cursor: after');
        }
        paginatedStages.push({ $match: { _id: { $gt: afterName } } });
      }
      paginatedStages.push({ $limit: limit + 1 });

      // Use $facet to get paginated results and total count in one query
      const facetResults = await context.db
        .collection('records')
        .aggregate([
          ...basePipeline,
          {
            $facet: {
              paginatedResults: paginatedStages,
              totalCount: [{ $count: 'count' }],
            },
          },
        ])
        .toArray();

      const facet = facetResults[0] as
        | { paginatedResults: { _id: string; recordCount: number; coverImageUrl?: string; genres: string[][] }[]; totalCount: { count: number }[] }
        | undefined;
      const rows = facet?.paginatedResults ?? [];
      const total: number = facet?.totalCount?.[0]?.count ?? 0;

      const hasNextPage = rows.length > limit;
      const items = hasNextPage ? rows.slice(0, limit) : rows;

      const edges = items.map((row) => {
        const genres = [...new Set(row.genres.flat().filter(Boolean))];
        const id = Buffer.from(`artist:${row._id}`).toString('base64');
        return {
          cursor: id,
          node: { id, name: row._id, recordCount: row.recordCount, coverImageUrl: row.coverImageUrl || null, genres },
        };
      });

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!_args.after,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
        totalCount: total,
      };
    },

    albums: async (
      _parent: unknown,
      _args: { first?: number; after?: string; filter?: { search?: string; artist?: string } },
      context: GraphQLContext
    ) => {
      if (!canRead(context)) throw new Error('Unauthorized: user not authenticated');
      if (!context.db) throw new Error('Tenant database connection not available');

      const limit = Math.min(_args.first || 20, 100);

      const lookupMatch: Record<string, unknown> = {};
      if (_args.filter?.artist) {
        lookupMatch['release.artist'] = { $regex: _args.filter.artist, $options: 'i' };
      }
      if (_args.filter?.search) {
        lookupMatch['$or'] = [
          { 'release.title': { $regex: _args.filter.search, $options: 'i' } },
          { 'release.artist': { $regex: _args.filter.search, $options: 'i' } },
        ];
      }

      const pipeline: object[] = [
        {
          $lookup: {
            from: 'releases',
            localField: 'releaseId',
            foreignField: '_id',
            as: 'release',
          },
        },
        { $unwind: '$release' },
        ...(Object.keys(lookupMatch).length ? [{ $match: lookupMatch }] : []),
        {
          $group: {
            _id: { artist: '$release.artist', title: '$release.title' },
            recordCount: { $sum: 1 },
            year: { $first: '$release.year' },
            coverImageUrl: { $first: '$release.coverImageUrl' },
            format: { $first: '$release.format' },
            genres: { $addToSet: '$release.genre' },
          },
        },
        { $sort: { '_id.artist': 1, '_id.title': 1 } },
        { $limit: limit + 1 },
      ];

      const rows = await context.db.collection('records').aggregate(pipeline).toArray();
      const hasNextPage = rows.length > limit;
      const items = hasNextPage ? rows.slice(0, limit) : rows;

      const edges = items.map((row) => {
        const genres = [...new Set((row.genres as string[][]).flat().filter(Boolean))];
        const id = Buffer.from(`album:${row._id.artist}|${row._id.title}`).toString('base64');
        return {
          cursor: id,
          node: {
            id,
            title: row._id.title as string,
            artist: row._id.artist as string,
            year: row.year || null,
            coverImageUrl: row.coverImageUrl || null,
            format: row.format || null,
            recordCount: row.recordCount as number,
            genres,
          },
        };
      });

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!_args.after,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
        totalCount: edges.length,
      };
    },

    genres: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!canRead(context)) throw new Error('Unauthorized: user not authenticated');
      if (!context.db) throw new Error('Tenant database connection not available');

      const pipeline: object[] = [
        {
          $lookup: {
            from: 'releases',
            localField: 'releaseId',
            foreignField: '_id',
            as: 'release',
          },
        },
        { $unwind: '$release' },
        { $unwind: '$release.genre' },
        { $match: { 'release.genre': { $exists: true, $nin: [null, ''] } } },
        {
          $group: {
            _id: '$release.genre',
            recordCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const rows = await context.db.collection('records').aggregate(pipeline).toArray();
      return rows.map((row) => ({ name: row._id as string, recordCount: row.recordCount as number }));
    },
  },
  Mutation: {
    scanBarcode: async (
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

      logger.debug(
        { barcode, albums: result.albums.length, rawReleases: result.rawReleases.length },
        'Barcode lookup complete'
      );

      // Build a lookup map from rawReleases by id (format: SOURCE‡externalId)
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
          logger.warn({ err }, 'Failed to upsert releases cache');
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
      requireMember(context);

      if (!context.db) {
        return { record: null, errors: ['Tenant database connection not available'] };
      }
      if (!context.userId) {
        return { record: null, errors: ['User ID not found in context'] };
      }

      try {
        const record = await createRecord(context.db, {
          ...(_args.input as any),
          userId: context.userId,
        });
        return {
          record: {
            id: record._id.toString(),
            releaseId: record.releaseId.toString(),
            userId: record.userId.toString(),
            purchaseDate: record.purchaseDate?.toISOString(),
            price: record.price,
            condition: record.condition,
            location: record.location,
            notes: record.notes,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
          },
          errors: [],
        };
      } catch (err: any) {
        return { record: null, errors: [err.message || 'Failed to create record'] };
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
      requireMember(context);

      if (!context.db) {
        return { record: null, errors: ['Tenant database connection not available'] };
      }

      try {
        const record = await updateRecord(context.db, _args.input as any);
        if (!record) {
          return { record: null, errors: [`Record with ID ${_args.input.id} not found`] };
        }
        return {
          record: {
            id: record._id.toString(),
            releaseId: record.releaseId.toString(),
            userId: record.userId.toString(),
            purchaseDate: record.purchaseDate?.toISOString(),
            price: record.price,
            condition: record.condition,
            location: record.location,
            notes: record.notes,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
          },
          errors: [],
        };
      } catch (err: any) {
        return { record: null, errors: [err.message || 'Failed to update record'] };
      }
    },
    deleteRecord: async (
      _parent: unknown,
      _args: { input: { id: string } },
      context: GraphQLContext
    ) => {
      requireMember(context);

      if (!context.db) {
        return { deletedRecordId: null, errors: ['Tenant database connection not available'] };
      }
      if (!context.userId) {
        return { deletedRecordId: null, errors: ['User ID not found in context'] };
      }

      try {
        const success = await deleteRecord(context.db, _args.input.id, context.userId);
        if (success) {
          return { deletedRecordId: _args.input.id, errors: [] };
        }
        return { deletedRecordId: null, errors: ['Record not found or not owned by user'] };
      } catch (err: any) {
        return { deletedRecordId: null, errors: [err.message || 'Failed to delete record'] };
      }
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

      logger.info({ userId, installationId }, 'User setting up installation');

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

      // 5. Ensure user is ADMIN in the org tenant (handles re-additions gracefully)
      await ensureUserInTenant(userObjId, existingTenant.tenantId, 'ADMIN');

      logger.info({ tenantId: existingTenant.tenantId }, 'Created org tenant');

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
  Record: {
    release: async (_parent: { releaseId: string }, _args: unknown, context: GraphQLContext) => {
      if (!context.db) {
        return null;
      }

      const releaseRepo = new ReleaseRepository(context.db);
      const release = await releaseRepo.findById(_parent.releaseId);

      if (!release) {
        return null;
      }

      return {
        id: release._id.toString(),
        barcode: release.barcode,
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
        source: release.source,
        createdAt:
          release.createdAt instanceof Date ? release.createdAt.toISOString() : release.createdAt,
        updatedAt:
          release.updatedAt instanceof Date ? release.updatedAt.toISOString() : release.updatedAt,
      };
    },
    owner: async (_parent: { userId: string }) => {
      return findUserById(_parent.userId);
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
    id: `${source}‡${release.externalId}`,
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
