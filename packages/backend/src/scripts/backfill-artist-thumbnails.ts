/**
 * Backfill script: populate artistThumbnailUrls on existing Discogs releases.
 *
 * Iterates every tenant's releases collection, finds DISCOGS releases that are
 * missing artistThumbnailUrls, fetches the Discogs release detail, extracts all
 * artists[].thumbnail_url entries, and writes them back.
 *
 * Rate-limited to ≤55 requests per minute (~1 req / 1090 ms) to stay well under
 * the Discogs authenticated API limit of 60 req/min.
 *
 * Usage:
 *   pnpm --filter @vinylvault/backend exec tsx src/scripts/backfill-artist-thumbnails.ts
 */

import { MongoClient } from 'mongodb';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getTenantDbName } from '../db/connection.js';
import { getReleaseDetails } from '../services/discogs.js';

const RATE_LIMIT_INTERVAL_MS = Math.ceil(60_000 / 55); // ~1090 ms between requests

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TenantEntry {
  tenantId: string;
  databaseName?: string;
}

async function main() {
  logger.info('Starting artist thumbnail backfill');

  // Connect to registry
  const registryClient = new MongoClient(config.mongodb.registryUri);
  await registryClient.connect();
  const registryDb = registryClient.db();

  // Connect to tenant base
  const tenantClient = new MongoClient(config.mongodb.uriBase);
  await tenantClient.connect();

  try {
    const tenants = await registryDb
      .collection<TenantEntry>('tenants')
      .find({}, { projection: { tenantId: 1, databaseName: 1 } })
      .toArray();

    logger.info({ tenantCount: tenants.length }, 'Found tenants');

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const tenant of tenants) {
      const dbName = tenant.databaseName ?? getTenantDbName(tenant.tenantId);
      const db = tenantClient.db(dbName);
      const releases = db.collection('releases');

      // Find DISCOGS releases missing the field (null, missing, or empty array)
      const cursor = releases.find({
        source: 'DISCOGS',
        externalId: { $exists: true, $ne: null },
        $or: [
          { artistThumbnailUrls: { $exists: false } },
          { artistThumbnailUrls: null },
          { artistThumbnailUrls: { $size: 0 } },
        ],
      });

      const count = await releases.countDocuments({
        source: 'DISCOGS',
        externalId: { $exists: true, $ne: null },
        $or: [
          { artistThumbnailUrls: { $exists: false } },
          { artistThumbnailUrls: null },
          { artistThumbnailUrls: { $size: 0 } },
        ],
      });

      if (count === 0) {
        logger.info({ tenantId: tenant.tenantId }, 'No releases to backfill for tenant');
        continue;
      }

      logger.info({ tenantId: tenant.tenantId, count }, 'Backfilling tenant releases');

      for await (const release of cursor) {
        totalProcessed++;
        const externalId = release.externalId as string;

        try {
          const details = await getReleaseDetails(externalId);
          const artistThumbnailUrls: string[] = Array.isArray(details?.artists)
            ? (details.artists as any[])
                .map((a) => a?.thumbnail_url)
                .filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
            : [];

          await releases.updateOne(
            { _id: release._id },
            { $set: { artistThumbnailUrls } }
          );

          logger.info(
            { tenantId: tenant.tenantId, externalId, count: artistThumbnailUrls.length },
            'Updated release artist thumbnails'
          );
          if (artistThumbnailUrls.length === 0) {
            totalSkipped++;
          } else {
            totalUpdated++;
          }
        } catch (err: any) {
          logger.error({ tenantId: tenant.tenantId, externalId, err: err?.message }, 'Failed to fetch/update release');
          totalErrors++;
        }

        // Rate limit: wait before next Discogs request
        await sleep(RATE_LIMIT_INTERVAL_MS);
      }
    }

    logger.info({ totalProcessed, totalUpdated, totalSkipped, totalErrors }, 'Backfill complete');
  } finally {
    await registryClient.close();
    await tenantClient.close();
  }
}

main().catch((err) => {
  logger.error({ err }, 'Backfill script failed');
  process.exit(1);
});
