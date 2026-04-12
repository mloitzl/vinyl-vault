// Sync Worker entry point
// Keeps Typesense in sync with MongoDB tenant databases via a change stream.
//
// Startup sequence:
//   1. Connect to MongoDB (tenant base + registry)
//   2. Ensure Typesense collection exists
//   3. If collection is empty → run full initial sync across all tenants
//   4. Load resume token from registry (if any)
//   5. Open change stream and process events indefinitely

import { MongoClient } from 'mongodb';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getRegistryDb, closeRegistryDb } from '../db/registry.js';
import { ensureCollection, isCollectionEmpty } from '../services/typesense.js';
import { loadResumeToken, saveResumeToken } from './token-store.js';
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

  // --- Initial sync if needed ----------------------------------------------
  if (await isCollectionEmpty()) {
    logger.info('Typesense collection is empty — running initial sync');
    await runInitialSync(tenantBaseClient, registryDb);

    // Capture the current change stream token AFTER initial sync so we don't
    // re-process events that were generated during the sync itself.
    const cursor = tenantBaseClient.watch([{ $match: { 'ns.db': /^vv_/ } }]);
    // Advance once to get the first token (we don't process any event here).
    const firstEvent = await Promise.race([
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      new Promise<unknown>((resolve) => cursor.once('change', resolve)),
    ]);
    const token = (firstEvent as any)?._id ?? null;
    await cursor.close();
    if (token) {
      await saveResumeToken(registryDb, token);
      logger.info('Saved initial resume token after full sync');
    }
  }

  // --- Resume token --------------------------------------------------------
  const resumeToken = await loadResumeToken(registryDb);

  // --- Change stream listener (runs forever) -------------------------------
  await startChangeStreamListener(tenantBaseClient, registryDb, resumeToken);
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info({ signal }, 'Sync worker shutting down');
  try {
    await closeRegistryDb();
  } catch (_) { /* ignore */ }
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
