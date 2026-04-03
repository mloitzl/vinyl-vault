// MongoDB connection and client

import { MongoClient, Db } from 'mongodb';
import { createHash } from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Single shared client for all tenant databases
let tenantBaseClient: MongoClient | null = null;

// Derive a tenant database name from a tenantId (user_{id} or org_{id}).
// MongoDB has a 38-byte limit for database names, so we use a hash of the tenantId
// Format: vv_<12-char-hash>, e.g., vv_a1b2c3d4e5f6
export function getTenantDbName(tenantId: string): string {
  const hash = createHash('sha256').update(tenantId).digest('hex').substring(0, 12);
  return `vv_${hash}`;
}

// Get a tenant Db instance using the shared connection pool.
// The shared MongoClient is initialised once; subsequent calls reuse the same pool.
export async function getTenantDb(tenantId: string): Promise<Db> {
  if (!tenantId) {
    throw new Error('tenantId is required to get tenant database');
  }

  if (!tenantBaseClient) {
    tenantBaseClient = new MongoClient(config.mongodb.uriBase, {
      maxPoolSize: 100,     // Shared across all tenants
      minPoolSize: 5,       // Keep a few connections warm
      maxIdleTimeMS: 60000, // Close idle connections after 1 minute
    });
    await tenantBaseClient.connect();
    logger.info('Connected shared base client for all tenant databases');
  }

  const dbName = getTenantDbName(tenantId);
  return tenantBaseClient.db(dbName);
}

// Close the shared tenant client
export async function closeTenantDbs(): Promise<void> {
  if (tenantBaseClient) {
    try {
      await tenantBaseClient.close();
      logger.info('Disconnected shared tenant base client');
    } catch (error) {
      logger.error({ err: error }, 'Error closing tenant base client');
    } finally {
      tenantBaseClient = null;
    }
  }
}

// Track which tenant databases have been initialized
const initializedTenants = new Set<string>();

/**
 * Initialize indexes for a tenant database.
 * This should be called once per tenant when the database is first accessed.
 */
export async function initializeTenantIndexes(tenantDb: Db, tenantId: string): Promise<void> {
  // Skip if already initialized
  if (initializedTenants.has(tenantId)) {
    return;
  }

  try {
    logger.info({ tenantId }, 'Initializing database indexes...');

    // Import repositories lazily to avoid circular dependencies
    const { RecordRepository } = await import('../models/record.js');
    const { ReleaseRepository } = await import('../models/release.js');
    const { CounterRepository } = await import('../models/counter.js');

    // Create indexes for records and releases collections
    const recordRepo = new RecordRepository(tenantDb);
    const releaseRepo = new ReleaseRepository(tenantDb);
    const counterRepo = new CounterRepository(tenantDb);

    await Promise.all([recordRepo.createIndexes(), releaseRepo.createIndexes()]);

    // Mark as initialized
    initializedTenants.add(tenantId);
    logger.info({ tenantId }, 'Database indexes created successfully');

    // Atlas Search indexes and counter reconciliation are submitted/run
    // asynchronously — building happens in the background on Atlas.
    Promise.all([
      recordRepo.createSearchIndexes(),
      releaseRepo.createSearchIndexes(),
    ]).catch((error) => {
      logger.error({ tenantId, err: error }, 'Error submitting Atlas Search indexes');
    });

    // Reconcile counters asynchronously (fire-and-forget)
    // This ensures counters are accurate from the first login
    counterRepo.reconcile().catch((error) => {
      logger.error({ tenantId, err: error }, 'Error reconciling counters');
    });
  } catch (error) {
    logger.error({ tenantId, err: error }, 'Error initializing database indexes');
    // Don't throw - indexes are best-effort
  }
}

