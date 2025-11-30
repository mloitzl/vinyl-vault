// Domain Backend GraphQL resolvers
// TODO: Implement business logic

import { findReleasesByBarcode, upsertReleases } from '../services/releasesCache.js';

export const resolvers = {
  Query: {
    user: async (_parent: unknown, _args: { id: string }) => {
      // TODO: Fetch user from MongoDB
      return null;
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
      const errors: string[] = [];
      const releases: any[] = [];

      if (!barcode) {
        return { releases: [], fromCache: false, errors: ['Barcode is required'] };
      }

      // Try MusicBrainz first (default)
      // Check cache first (FR-2 / NFR-3)
      try {
        const cached = await findReleasesByBarcode(barcode);
        if (Array.isArray(cached) && cached.length > 0) {
          return { releases: cached, fromCache: true, errors };
        }
      } catch (err: any) {
        // don't fail the lookup if cache check errors — fall back to live APIs
        console.warn('Releases cache check failed:', err?.message ?? String(err));
      }

      try {
        const mb = await import('../services/musicbrainz.js');
        const results = await mb.searchByBarcode(barcode);
        for (const r of results) {
          const artist =
            Array.isArray(r['artist-credit']) && r['artist-credit'][0]
              ? r['artist-credit'][0].name
              : 'Unknown';
          const externalId = String(r.id);
          const source = 'MUSICBRAINZ';
          const now = new Date().toISOString();
          releases.push({
            id: `${source}:${externalId}`,
            barcode,
            artist,
            title: r.title,
            year: r.date ? parseInt(String(r.date).slice(0, 4), 10) : null,
            format: undefined,
            genre: [],
            style: [],
            label:
              Array.isArray(r['label-info']) && r['label-info'][0] && r['label-info'][0].label
                ? r['label-info'][0].label.name
                : undefined,
            country: r.country,
            coverImageUrl: undefined,
            trackList: [],
            externalId,
            source,
            createdAt: now,
            updatedAt: now,
          });
        }
      } catch (err: any) {
        errors.push(`MusicBrainz error: ${err?.message ?? String(err)}`);
      }

      // If no results from MusicBrainz, try Discogs
      if (releases.length === 0) {
        try {
          const dg = await import('../services/discogs.js');
          const results = await dg.searchByBarcode(barcode);
          for (const r of results) {
            const externalId = String(r.id);
            const source = 'DISCOGS';
            const now = new Date().toISOString();
            releases.push({
              id: `${source}:${externalId}`,
              barcode,
              artist: r.title?.split(' - ')[0] || 'Unknown',
              title: r.title || 'Unknown',
              year: r.year ? parseInt(String(r.year).slice(0, 4), 10) : null,
              format: Array.isArray(r.format) ? r.format.join(', ') : undefined,
              genre: [],
              style: [],
              label: Array.isArray(r.label) ? r.label.join(', ') : undefined,
              country: r.country,
              coverImageUrl: r.cover_image,
              trackList: [],
              externalId,
              source,
              createdAt: now,
              updatedAt: now,
            });
          }
        } catch (err: any) {
          errors.push(`Discogs error: ${err?.message ?? String(err)}`);
        }
      }

      // Persist fetched results to cache (best-effort)
      try {
        await upsertReleases(releases as any);
      } catch (err: any) {
        console.warn('Failed to upsert releases cache:', err?.message ?? String(err));
      }

      return { releases, fromCache: false, errors };
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
    upsertUser: async (_parent: unknown, _args: unknown) => {
      // TODO: Create or update user
      throw new Error('Not implemented');
    },
    updateUserRole: async (_parent: unknown, _args: unknown) => {
      // TODO: Update user role (admin only)
      throw new Error('Not implemented');
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
