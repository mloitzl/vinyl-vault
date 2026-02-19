// MongoDB connection for BFF (session store and user lookup)

import { MongoClient, Db } from 'mongodb';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let client: MongoClient | null = null;
let db: Db | null = null;

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

  logger.info('BFF connected to MongoDB');
  return db;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('BFF disconnected from MongoDB');
  }
}

export function getDatabase(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase first.');
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error('Database not connected. Call connectToDatabase first.');
  }
  return client;
}
