// Registry database connection (central tenant registry)
// Provides a singleton connection to the registry database used for users, tenants, and user_tenant_roles.

import { MongoClient, Db } from 'mongodb';
import { config } from '../config/index.js';

let registryClient: MongoClient | null = null;
let registryDb: Db | null = null;

export async function getRegistryDb(): Promise<Db> {
  if (registryDb) {
    return registryDb;
  }

  registryClient = new MongoClient(config.mongodb.registryUri);
  await registryClient.connect();
  registryDb = registryClient.db();

  console.log('[registry] Connected to MongoDB registry database');
  return registryDb;
}

export async function closeRegistryDb(): Promise<void> {
  if (registryClient) {
    await registryClient.close();
    registryClient = null;
    registryDb = null;
    console.log('[registry] Disconnected from MongoDB registry database');
  }
}
