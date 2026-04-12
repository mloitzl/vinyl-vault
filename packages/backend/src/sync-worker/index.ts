// Sync Worker entry point
// Keeps Typesense in sync with MongoDB tenant databases via a change stream.
//
// Startup sequence:
//   1. Connect to MongoDB (tenant base + registry)
//   2. Ensure Typesense collection exists
//   3. If collection is empty → capture cluster timestamp, run full initial sync,
//      then open change stream from that timestamp (avoids missing writes during sync)
//   4. Otherwise load the saved resume token and open change stream from there

import { MongoClient } from 'mongodb';
import type { Timestamp } from 'mongodb';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getRegistryDb, closeRegistryDb } from '../db/registry.js';
import { ensureCollection, isCollectionEmpty } from '../services/typesense.js';
import { loadResumeToken } from './token-store.js';
import { runInitialSync } from './initial-sync.js';
import { startChangeStreamListener } from './change-stream-listener.js';

async function main() {
  logger.info('Sync worker starting');

  // --- MongoDB connections -----------------------------------------------
  const tenantBaseClient = new MongoClient(config.mongodb.uriBase, {
    maxPoolSize: 20,
    minPoolSize: 2,
    maxIdleTimeMS: 60_000,
  });
  await tenantBaseClient.connect();
  logger.info('Connected to tenant MongoDB cluster');

  const registryDb = await getRegistryDb();

  // --- Typesense collection ------------------------------------------------
  await ensureCollection();

  // --- Initial sync if needed, otherwise load resume token -----------------
  let resumeToken = null;
  let startAtOperationTime: Timestamp | null = null;

  if (await isCollectionEmpty()) {
    // Capture the cluster timestamp BEFORE starting the bulk sync so that the
    // change stream can replay any writes that arrive during the sync window.
    const pingResult = await tenantBaseClient.db().admin().command({ ping: 1 });
    startAtOperationTime = (pingResult.operationTime as Timestamp) ?? null;

    logger.info('Typesense collection is empty — running initial sync');
    await runInitialSync(tenantBaseClient, registryDb);
    logger.info('Initial sync complete — change stream will resume from pre-sync timestamp');
  } else {
    resumeToken = await loadResumeToken(registryDb);
  }

  // --- Change stream listener (runs forever) -------------------------------
  await startChangeStreamListener(tenantBaseClient, registryDb, resumeToken, startAtOperationTime);
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Sync worker shutting down');
  try {
    await closeRegistryDb();
  } catch { /* ignore */ }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception in sync worker — exiting');
  process.exit(1);
});

main().catch((err) => {
  logger.error({ err }, 'Sync worker failed to start');
  process.exit(1);
});
