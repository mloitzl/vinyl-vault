// MongoDB connection and client
// TODO: Implement MongoDB connection

import { MongoClient, Db } from 'mongodb';
import { config } from '../config/index.js';

let client: MongoClient | null = null;
let db: Db | null = null;

// Tenant database connection pool (cache connections by tenantId)
const tenantClients = new Map<string, MongoClient>();
const tenantDbs = new Map<string, Db>();

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(config.mongodb.uri);
  await client.connect();
  db = client.db();

  console.log('Connected to MongoDB');
  return db;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('Disconnected from MongoDB');
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase first.');
  }
  return db;
}

// Derive a tenant database name from a tenantId (user_{id} or org_{id}).
// Naming convention: vinylvault_<tenantId>, e.g., vinylvault_user_123, vinylvault_org_98765.
export function getTenantDbName(tenantId: string): string {
  return `vinylvault_${tenantId}`;
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
  const tenantClient = new MongoClient(config.mongodb.uriBase);
  
  try {
    await tenantClient.connect();
    const tenantDb = tenantClient.db(dbName);
    
    // Cache the connection and client for reuse
    tenantClients.set(tenantId, tenantClient);
    tenantDbs.set(tenantId, tenantDb);
    
    console.log(`[tenant-${tenantId}] Connected to tenant database: ${dbName}`);
    return tenantDb;
  } catch (error) {
    tenantClient.close().catch(() => {});
    throw new Error(`Failed to connect to tenant database ${dbName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Close all tenant database connections
export async function closeTenantDbs(): Promise<void> {
  const closePromises = Array.from(tenantClients.entries()).map(async ([tenantId, tenantClient]) => {
    try {
      await tenantClient.close();
      console.log(`[tenant-${tenantId}] Disconnected from tenant database`);
    } catch (error) {
      console.error(`[tenant-${tenantId}] Error closing tenant database:`, error);
    }
  });

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
    console.log(`[tenant-${tenantId}] Initializing database indexes...`);
    
    // Import repositories lazily to avoid circular dependencies
    const { RecordRepository } = await import('../models/record.js');
    const { ReleaseRepository } = await import('../models/release.js');
    
    // Create indexes for records and releases collections
    const recordRepo = new RecordRepository(tenantDb);
    const releaseRepo = new ReleaseRepository(tenantDb);
    
    await Promise.all([
      recordRepo.createIndexes(),
      releaseRepo.createIndexes(),
    ]);
    
    // Mark as initialized
    initializedTenants.add(tenantId);
    console.log(`[tenant-${tenantId}] Database indexes created successfully`);
  } catch (error) {
    console.error(`[tenant-${tenantId}] Error initializing database indexes:`, error);
    // Don't throw - indexes are best-effort
  }
}

