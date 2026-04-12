// MongoDB change-stream listener for the sync worker.
// Opens a single client.watch() cursor on all tenant databases (vv_* namespaces)
// and keeps Typesense in sync with every insert/update/replace/delete/dropDatabase.

import type { MongoClient, Db, Document, ChangeStreamDocument, Timestamp } from 'mongodb';
import { logger } from '../utils/logger.js';
import { saveResumeToken } from './token-store.js';
import { upsertRecord, deleteRecord, deleteTenantRecords } from '../services/typesense.js';
import type { RecordDocument } from '../models/record.js';
import { getTenantDbName } from '../db/connection.js';

// Persist resume token every N processed events to limit registry writes.
const SAVE_TOKEN_EVERY = 50;

/**
 * Resolve a database name to a tenantId using the registry.
 * Fast path: findOne({ databaseName }). Falls back to a full scan with computed names.
 */
async function resolveTenantId(
  dbName: string,
  registryDb: Db,
  cache: Map<string, string>,
): Promise<string | null> {
  if (cache.has(dbName)) return cache.get(dbName)!;

  // Fast path: tenant document stores databaseName explicitly
  const direct = await registryDb
    .collection<{ tenantId: string; databaseName?: string }>('tenants')
    .findOne({ databaseName: dbName }, { projection: { tenantId: 1 } });

  if (direct) {
    cache.set(dbName, direct.tenantId);
    return direct.tenantId;
  }

  // Fallback: scan all tenants and compute their database names
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

  logger.warn({ dbName }, 'Could not resolve tenantId for database — skipping event');
  return null;
}

export async function startChangeStreamListener(
  tenantBaseClient: MongoClient,
  registryDb: Db,
  resumeToken: Document | null,
  startAtOperationTime: Timestamp | null,
): Promise<void> {
  const pipeline: Document[] = [
    { $match: { 'ns.db': /^vv_/ } },
  ];

  const options: Record<string, unknown> = {
    fullDocument: 'updateLookup',
    fullDocumentBeforeChange: 'off',
  };
  if (resumeToken) {
    options.resumeAfter = resumeToken;
  } else if (startAtOperationTime) {
    options.startAtOperationTime = startAtOperationTime;
  }

  const changeStream = tenantBaseClient.watch(pipeline, options);

  logger.info('Change stream listener started');

  const tenantIdCache = new Map<string, string>();
  let processedSinceLastSave = 0;
  let lastToken: Document | null = resumeToken;

  // Periodic flush of resume token even in low-traffic environments.
  const flushInterval = setInterval(async () => {
    if (lastToken && processedSinceLastSave > 0) {
      await saveResumeToken(registryDb, lastToken);
      processedSinceLastSave = 0;
    }
  }, 10_000);

  try {
    // Sequential for-await loop ensures backpressure: each event is fully
    // processed before the next one is read, and the resume token only
    // advances after successful handling.
    for await (const event of changeStream as AsyncIterable<ChangeStreamDocument>) {
      lastToken = (event as any)._id ?? lastToken;

      const dbName: string | undefined = (event as any).ns?.db;
      if (!dbName) continue;

      try {
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
          if ((event as any).ns?.coll !== 'records') continue;

          const doc: RecordDocument | undefined = (event as any).fullDocument;
          if (!doc) continue;

          const tenantId = await resolveTenantId(dbName, registryDb, tenantIdCache);
          if (!tenantId) continue;

          await upsertRecord(tenantId, doc);
        } else if (event.operationType === 'delete') {
          if ((event as any).ns?.coll !== 'records') continue;

          const id: string = (event as any).documentKey?._id?.toString();
          if (!id) continue;

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
    }
  } finally {
    clearInterval(flushInterval);
    if (lastToken && processedSinceLastSave > 0) {
      await saveResumeToken(registryDb, lastToken).catch(() => {});
    }
  }

  // Stream ended (not expected — the sync worker should restart via process supervisor)
  logger.warn('Change stream closed unexpectedly — sync worker will restart');
  process.exit(1);
}
