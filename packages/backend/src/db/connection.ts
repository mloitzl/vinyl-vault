// MongoDB connection and client
// TODO: Implement MongoDB connection

import { MongoClient, Db } from 'mongodb';
import { createHash } from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let client: MongoClient | null = null;
let db: Db | null = null;

// Tenant database connection pool (cache connections by tenantId)
const tenantClients = new Map<string, MongoClient>();
const tenantDbs = new Map<string, Db>();

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(config.mongodb.uri, {
    maxPoolSize: 10, // Limit connection pool size
    minPoolSize: 2,
    maxIdleTimeMS: 60000, // Close idle connections after 1 minute
  });
  await client.connect();
  db = client.db();

  logger.info('Connected to MongoDB');
  return db;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('Disconnected from MongoDB');
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase first.');
  }
  return db;
}

// Derive a tenant database name from a tenantId (user_{id} or org_{id}).
// MongoDB has a 38-byte limit for database names, so we use a hash of the tenantId
// Format: vv_<12-char-hash>, e.g., vv_a1b2c3d4e5f6
export function getTenantDbName(tenantId: string): string {
  const hash = createHash('sha256').update(tenantId).digest('hex').substring(0, 12);
  return `vv_${hash}`;
}

// Get or create a tenant database connection (cached by tenantId).
// Uses MONGODB_URI_BASE from config to dynamically connect to tenant-specific databases.
export async function getTenantDb(tenantId: string): Promise<Db> {
  if (!tenantId) {
    throw new Error('tenantId is required to get tenant database');
  }

  // Check if we already have a cached connection for this tenant
  if (tenantDbs.has(tenantId)) {
    return tenantDbs.get(tenantId)!;
  }

  // Create new connection for this tenant
  const dbName = getTenantDbName(tenantId);
  const tenantClient = new MongoClient(config.mongodb.uriBase, {
    maxPoolSize: 5, // Smaller pool per tenant to avoid exhausting total connections
    minPoolSize: 1,
    maxIdleTimeMS: 60000, // Close idle connections after 1 minute
  });

  try {
    await tenantClient.connect();
    const tenantDb = tenantClient.db(dbName);

    // Cache the connection and client for reuse
    tenantClients.set(tenantId, tenantClient);
    tenantDbs.set(tenantId, tenantDb);

    logger.info({ tenantId, dbName }, 'Connected to tenant database');
    return tenantDb;
  } catch (error) {
    tenantClient.close().catch(() => {});
    throw new Error(
      `Failed to connect to tenant database ${dbName}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// Close all tenant database connections
export async function closeTenantDbs(): Promise<void> {
  const closePromises = Array.from(tenantClients.entries()).map(
    async ([tenantId, tenantClient]) => {
      try {
        await tenantClient.close();
        logger.info({ tenantId }, 'Disconnected from tenant database');
      } catch (error) {
        logger.error({ tenantId, err: error }, 'Error closing tenant database');
      }
    }
  );

  await Promise.all(closePromises);
  tenantClients.clear();
  tenantDbs.clear();
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

