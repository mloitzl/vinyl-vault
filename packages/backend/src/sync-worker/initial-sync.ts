// Full initial sync: reads all records from every tenant DB and upserts to Typesense.
// Called by the sync worker when the Typesense collection is empty (first run or after wipe).

import type { Db, MongoClient } from 'mongodb';
import { logger } from '../utils/logger.js';
import { getTenantDbName } from '../db/connection.js';
import { upsertRecord } from '../services/typesense.js';
import type { RecordDocument } from '../models/record.js';

const BATCH_SIZE = 500;

interface TenantEntry {
  tenantId: string;
  databaseName?: string;
}

/**
 * Read all tenants from the registry and bulk-upsert their records into Typesense.
 * Each record is processed in batches of BATCH_SIZE to limit memory usage.
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

    let skip = 0;
    while (skip < total) {
      const batch = await collection
        .find()
        .skip(skip)
        .limit(BATCH_SIZE)
        .toArray();

      await Promise.all(batch.map((doc) => upsertRecord(tenantId, doc)));
      skip += batch.length;
      totalUpserted += batch.length;
    }

    logger.info({ tenantId, synced: Math.min(skip, total) }, 'Tenant sync complete');
  }

  logger.info({ totalUpserted }, 'Initial Typesense sync complete');
}
