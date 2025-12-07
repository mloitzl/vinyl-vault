// Domain Backend GraphQL resolvers

import { upsertReleases } from '../services/releasesCache.js';
import { findUserById, upsertUser, updateUserRole } from '../services/users.js';
import { lookupAndScoreBarcode } from '../services/scoring/index.js';
import type { Album, RawRelease, ScoringDetail } from '../services/scoring/types.js';

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
  },
  Mutation: {
    lookupBarcode: async (_parent: unknown, _args: { barcode: string }) => {
      const { barcode } = _args;

      if (!barcode) {
        return {
          albums: [],
          releases: [],
          fromCache: false,
          timing: null,
          errors: ['Barcode is required'],
        };
      }

      // Check cache first (FR-2 / NFR-3)
      // TODO: For now, skip cache to always use the scoring orchestrator
      // In future, cache the Album structure directly instead of raw releases
      /*
      try {
        const cached = await findReleasesByBarcode(barcode);
        if (Array.isArray(cached) && cached.length > 0) {
          // For cached results, we return as legacy releases format
          // TODO: In future, cache the Album structure directly
          return {
            albums: [],
            releases: cached,
            fromCache: true,
            timing: null,
            errors: [],
          };
        }
      } catch (err: any) {
        // don't fail the lookup if cache check errors — fall back to live APIs
        console.warn('Releases cache check failed:', err?.message ?? String(err));
      }
      */

      // Use the new blended scoring orchestrator
      const result = await lookupAndScoreBarcode(barcode);

      console.log(`[lookupBarcode] Got ${result.albums.length} albums, ${result.rawReleases.length} raw releases`);

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
          primaryRelease: primaryRaw ? {
            release: toGraphQLRelease(primaryRaw, barcode),
            score: album.primaryReleaseScore,
            scoreBreakdown: primaryScoring ? {
              mediaType: primaryScoring.mediaTypeScore,
              countryPreference: primaryScoring.countryScore,
              trackListCompleteness: primaryScoring.completenessScore,
              coverArt: 0, // Not tracked separately in ScoringDetail
              labelInfo: 0,
              catalogNumber: 0,
              yearInfo: 0,
              sourceBonus: 0,
            } : null,
          } : null,
          alternativeReleases: album.alternativeReleases.map(alt => ({
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
      const releases = result.rawReleases.map((raw: RawRelease) =>
        toGraphQLRelease(raw, barcode)
      );

      // Persist fetched results to cache (best-effort)
      if (releases.length > 0) {
        try {
          await upsertReleases(releases as any);
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
    createRecord: async (_parent: unknown, _args: unknown) => {
      // TODO: Create record in MongoDB
      throw new Error('Not implemented');
    },
    updateRecord: async (_parent: unknown, _args: unknown) => {
      // TODO: Update record in MongoDB
      throw new Error('Not implemented');
    },
    deleteRecord: async (_parent: unknown, _args: { id: string }) => {
      // TODO: Delete record from MongoDB
      throw new Error('Not implemented');
    },
    upsertUser: async (_parent: unknown, _args: { input: { githubId: string; githubLogin: string; displayName: string; avatarUrl?: string; email?: string } }) => {
      return upsertUser(_args.input);
    },
    updateUserRole: async (_parent: unknown, _args: { userId: string; role: 'ADMIN' | 'CONTRIBUTOR' | 'READER' }) => {
      const user = await updateUserRole(_args.userId, _args.role);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
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
