// Full initial sync: reads all records from every tenant DB and upserts to Typesense.
// Called by the sync worker when the Typesense collection is empty (first run or after wipe).

import type { Db, MongoClient, ObjectId, Filter } from 'mongodb';
import { logger } from '../utils/logger.js';
import { getTenantDbName } from '../db/connection.js';
import { importRecords } from '../services/typesense.js';
import type { RecordDocument } from '../models/record.js';

const BATCH_SIZE = 500;

interface TenantEntry {
  tenantId: string;
  databaseName?: string;
}

/**
 * Read all tenants from the registry and bulk-upsert their records into Typesense.
 * Uses _id-range cursor pagination (instead of skip) to avoid O(n²) cost on large
 * collections, and sends records in batches via the Typesense bulk import API.
 */
export async function runInitialSync(
  tenantBaseClient: MongoClient,
  registryDb: Db,
): Promise<void> {
  const tenants = await registryDb
    .collection<TenantEntry>('tenants')
    .find({}, { projection: { tenantId: 1, databaseName: 1 } })
    .toArray();

  if (tenants.length === 0) {
    logger.info('No tenants found in registry — skipping initial sync');
    return;
  }

  logger.info({ tenantCount: tenants.length }, 'Starting initial Typesense sync');
  let totalUpserted = 0;

  for (const tenant of tenants) {
    const tenantId = tenant.tenantId;
    const dbName = tenant.databaseName ?? getTenantDbName(tenantId);
    const db = tenantBaseClient.db(dbName);

    const collection = db.collection<RecordDocument>('records');
    const total = await collection.countDocuments();
    if (total === 0) continue;

    logger.info({ tenantId, total }, 'Syncing tenant records to Typesense');

    // Cursor-based pagination: sort by _id and use $gt to avoid skip
    let lastId: ObjectId | null = null;
    let synced = 0;

    for (;;) {
      const filter: Filter<RecordDocument> = lastId ? { _id: { $gt: lastId } } : {};
      const batch = await collection
        .find(filter)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .toArray();

      if (batch.length === 0) break;

      await importRecords(tenantId, batch);
      synced += batch.length;
      totalUpserted += batch.length;
      lastId = batch[batch.length - 1]._id!;
    }

    logger.info({ tenantId, synced }, 'Tenant sync complete');
  }

  logger.info({ totalUpserted }, 'Initial Typesense sync complete');
}
