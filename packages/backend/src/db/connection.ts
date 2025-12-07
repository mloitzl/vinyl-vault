// MongoDB connection and client
// TODO: Implement MongoDB connection

import { MongoClient, Db } from 'mongodb';
import { config } from '../config/index.js';

let client: MongoClient | null = null;
let db: Db | null = null;

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
