// Registry database connection (central tenant registry)
// Provides a singleton connection to the registry database used for users, tenants, and user_tenant_roles.

import { MongoClient, Db } from 'mongodb';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let registryClient: MongoClient | null = null;
let registryDb: Db | null = null;

export async function getRegistryDb(): Promise<Db> {
  if (registryDb) {
    return registryDb;
  }

  registryClient = new MongoClient(config.mongodb.registryUri);
  await registryClient.connect();
  registryDb = registryClient.db();

  logger.info('Connected to MongoDB registry database');
  return registryDb;
}

export async function closeRegistryDb(): Promise<void> {
  if (registryClient) {
    await registryClient.close();
    registryClient = null;
    registryDb = null;
    logger.info('Disconnected from MongoDB registry database');
  }
}

// Ensure required collections and indexes exist for registry data
export async function ensureRegistryIndexes(): Promise<void> {
  const db = await getRegistryDb();

  const installations = db.collection('installations');
  await installations.createIndex({ installation_id: 1 }, { unique: true });
  await installations.createIndex({ account_login: 1 });
  await installations.createIndex({ installed_by_user_id: 1 });

  const userInstallationRoles = db.collection('user_installation_roles');
  await userInstallationRoles.createIndex({ user_id: 1, installation_id: 1 }, { unique: true });
  await userInstallationRoles.createIndex({ installation_id: 1 });
  await userInstallationRoles.createIndex({ org_name: 1 });

  logger.info('Ensured indexes for installations and user_installation_roles');
}
