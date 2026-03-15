// User service for database operations

import { ObjectId } from 'mongodb';
import { getRegistryDb } from '../db/registry.js';
import { COLLECTIONS } from '../db/collections.js';
import type { UserSettings } from '../models/user.js';

export type { UserSettings } from '../models/user.js';

export interface UserDocument {
  _id: ObjectId;
  githubId: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  settings?: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertUserInput {
  githubId: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
}

export interface User {
  id: string;
  githubId: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  settings?: UserSettings;
  createdAt: string;
  updatedAt: string;
}

function documentToUser(doc: UserDocument): User {
  return {
    id: doc._id.toString(),
    githubId: doc.githubId,
    githubLogin: doc.githubLogin,
    displayName: doc.displayName,
    avatarUrl: doc.avatarUrl,
    email: doc.email,
    settings: doc.settings,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await getRegistryDb();
  const collection = db.collection<UserDocument>(COLLECTIONS.USERS);
  
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(id);
  } catch {
    return null;
  }
  
  const doc = await collection.findOne({ _id: objectId });
  return doc ? documentToUser(doc) : null;
}

export async function findUserByGithubId(githubId: string): Promise<User | null> {
  const db = await getRegistryDb();
  const collection = db.collection<UserDocument>(COLLECTIONS.USERS);
  const doc = await collection.findOne({ githubId });
  return doc ? documentToUser(doc) : null;
}

export async function upsertUser(input: UpsertUserInput): Promise<User> {
  const db = await getRegistryDb();
  const collection = db.collection<UserDocument>(COLLECTIONS.USERS);
  
  const now = new Date();
  const existingUser = await collection.findOne({ githubId: input.githubId });
  
  if (existingUser) {
    // Update existing user
    await collection.updateOne(
      { githubId: input.githubId },
      {
        $set: {
          githubLogin: input.githubLogin,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          email: input.email,
          updatedAt: now,
        },
      }
    );
    
    const updated = await collection.findOne({ githubId: input.githubId });
    return documentToUser(updated!);
  } else {
    // Create new user
    const result = await collection.insertOne({
      _id: new ObjectId(),
      githubId: input.githubId,
      githubLogin: input.githubLogin,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      email: input.email,
      createdAt: now,
      updatedAt: now,
    });
    
    const created = await collection.findOne({ _id: result.insertedId });
    return documentToUser(created!);
  }
}

export async function updateUserSettings(
  userId: string,
  patch: Partial<UserSettings>
): Promise<User> {
  const db = await getRegistryDb();
  const collection = db.collection<UserDocument>(COLLECTIONS.USERS);

  let objectId: ObjectId;
  try {
    objectId = new ObjectId(userId);
  } catch {
    throw new Error('Invalid user ID');
  }

  // Build $set entries scoped to the settings sub-document
  const setFields: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      setFields[`settings.${key}`] = value;
    }
  }

  await collection.updateOne({ _id: objectId }, { $set: setFields });

  const updated = await collection.findOne({ _id: objectId });
  if (!updated) throw new Error('User not found');
  return documentToUser(updated);
}
