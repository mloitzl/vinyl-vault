// MongoDB change-stream listener for the sync worker.
// Opens a single client.watch() cursor on all tenant databases (vv_* namespaces)
// and keeps Typesense in sync with every insert/update/replace/delete/dropDatabase.

import type { MongoClient, Db, Document, ChangeStreamDocument } from 'mongodb';
import { logger } from '../utils/logger.js';
import { saveResumeToken } from './token-store.js';
import { upsertRecord, deleteRecord, deleteTenantRecords } from '../services/typesense.js';
import type { RecordDocument } from '../models/record.js';
import { getTenantDbName } from '../db/connection.js';

// Persist resume token every N processed events to limit registry writes.
const SAVE_TOKEN_EVERY = 50;

/**
 * Extract tenantId from a database name in a change event.
 * The db name is `vv_<12-hex-hash>`.  We reverse-lookup from the registry
 * so we always have the canonical tenantId.
 */
async function resolveTenantId(
  dbName: string,
  registryDb: Db,
  cache: Map<string, string>,
): Promise<string | null> {
  if (cache.has(dbName)) return cache.get(dbName)!;

  const doc = await registryDb
    .collection<{ tenantId: string; databaseName?: string }>('tenants')
    .findOne({ $or: [{ databaseName: dbName }, {}] }, { projection: { tenantId: 1, databaseName: 1 } });

  // Fast path: the registry stores databaseName explicitly on newer tenants.
  // Fallback: brute-force match via getTenantDbName hash comparison.
  if (doc) {
    // Find the matching tenant by checking whether its computed dbName matches.
    // We need to find the entry whose databaseName (or computed name) equals dbName.
    const all = await registryDb
      .collection<{ tenantId: string; databaseName?: string }>('tenants')
      .find({}, { projection: { tenantId: 1, databaseName: 1 } })
      .toArray();

    for (const t of all) {
      const computed = t.databaseName ?? getTenantDbName(t.tenantId);
      if (computed === dbName) {
        cache.set(dbName, t.tenantId);
        return t.tenantId;
      }
    }
  }

  logger.warn({ dbName }, 'Could not resolve tenantId for database — skipping event');
  return null;
}

export async function startChangeStreamListener(
  tenantBaseClient: MongoClient,
  registryDb: Db,
  resumeToken: Document | null,
): Promise<void> {
  // Filter: only events from databases whose name starts with vv_
  const pipeline: Document[] = [
    { $match: { 'ns.db': /^vv_/ } },
  ];

  const options: Record<string, unknown> = {
    fullDocument: 'updateLookup',
    fullDocumentBeforeChange: 'off',
  };
  if (resumeToken) options.resumeAfter = resumeToken;

  const changeStream = tenantBaseClient.watch(pipeline, options);

  logger.info('Change stream listener started');

  const tenantIdCache = new Map<string, string>();
  let processedSinceLastSave = 0;
  let lastToken: Document | null = resumeToken;

  changeStream.on('change', async (event: ChangeStreamDocument) => {
    try {
      lastToken = (event as any)._id ?? lastToken;

      const dbName: string | undefined = (event as any).ns?.db;
      if (!dbName) return;

      if (event.operationType === 'dropDatabase') {
        const tenantId = await resolveTenantId(dbName, registryDb, tenantIdCache);
        if (tenantId) {
          await deleteTenantRecords(tenantId);
          tenantIdCache.delete(dbName);
          logger.info({ tenantId }, 'Deleted all Typesense records for dropped tenant DB');
        }
      } else if (
        event.operationType === 'insert' ||
        event.operationType === 'update' ||
        event.operationType === 'replace'
      ) {
        // Only sync the `records` collection
        if ((event as any).ns?.coll !== 'records') return;

        const doc: RecordDocument | undefined = (event as any).fullDocument;
        if (!doc) return;

        const tenantId = await resolveTenantId(dbName, registryDb, tenantIdCache);
        if (!tenantId) return;

        await upsertRecord(tenantId, doc);
      } else if (event.operationType === 'delete') {
        if ((event as any).ns?.coll !== 'records') return;

        const id: string = (event as any).documentKey?._id?.toString();
        if (!id) return;

        await deleteRecord(id);
      }

      processedSinceLastSave++;
      if (processedSinceLastSave >= SAVE_TOKEN_EVERY && lastToken) {
        await saveResumeToken(registryDb, lastToken);
        processedSinceLastSave = 0;
      }
    } catch (err) {
      logger.error({ err, operationType: event.operationType }, 'Error processing change event');
    }
  });

  changeStream.on('error', (err) => {
    logger.error({ err }, 'Change stream error — sync worker will restart');
    process.exit(1);
  });

  changeStream.on('close', () => {
    logger.warn('Change stream closed unexpectedly — sync worker will restart');
    process.exit(1);
  });

  // Periodically flush resume token even with low-traffic tenants
  setInterval(async () => {
    if (lastToken && processedSinceLastSave > 0) {
      await saveResumeToken(registryDb, lastToken);
      processedSinceLastSave = 0;
    }
  }, 10_000);
}
