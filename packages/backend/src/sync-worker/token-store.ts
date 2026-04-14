// Persist/load the MongoDB change-stream resume token in the registry DB.
// Stored in collection `sync_state` under document id `changeStreamToken`.

import type { Db, Document } from 'mongodb';
import { logger } from '../utils/logger.js';

const COLLECTION = 'sync_state';
const DOC_ID = 'changeStreamToken';

interface SyncStateDoc {
  _id: string;
  resumeToken: Document;
  updatedAt: Date;
}

export async function loadResumeToken(registryDb: Db): Promise<Document | null> {
  try {
    const doc = await registryDb.collection<SyncStateDoc>(COLLECTION).findOne({ _id: DOC_ID });
    if (doc?.resumeToken) {
      logger.info('Loaded change-stream resume token from registry');
      return doc.resumeToken;
    }
  } catch (err) {
    logger.warn({ err }, 'Could not load resume token — starting from scratch');
  }
  return null;
}

export async function saveResumeToken(registryDb: Db, token: Document): Promise<void> {
  await registryDb.collection<SyncStateDoc>(COLLECTION).updateOne(
    { _id: DOC_ID },
    { $set: { resumeToken: token, updatedAt: new Date() } },
    { upsert: true },
  );
  // Errors propagate to the caller — it is the caller's responsibility to decide
  // whether to retry, log, or exit when the token cannot be persisted.
}

export async function clearResumeToken(registryDb: Db): Promise<void> {
  await registryDb.collection(COLLECTION).deleteOne({ _id: DOC_ID as any });
}
