// User service for database operations

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db/connection.js';
import { COLLECTIONS } from '../db/collections.js';

export interface UserDocument {
  _id: ObjectId;
  githubId: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
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
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
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
    role: doc.role,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function findUserById(id: string): Promise<User | null> {
  const db = await connectToDatabase();
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
  const db = await connectToDatabase();
  const collection = db.collection<UserDocument>(COLLECTIONS.USERS);
  const doc = await collection.findOne({ githubId });
  return doc ? documentToUser(doc) : null;
}

export async function upsertUser(input: UpsertUserInput): Promise<User> {
  const db = await connectToDatabase();
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
    // Create new user - first user becomes ADMIN, others become CONTRIBUTOR
    const userCount = await collection.countDocuments();
    const role = userCount === 0 ? 'ADMIN' : 'CONTRIBUTOR';
    
    const result = await collection.insertOne({
      _id: new ObjectId(),
      githubId: input.githubId,
      githubLogin: input.githubLogin,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      email: input.email,
      role,
      createdAt: now,
      updatedAt: now,
    });
    
    const created = await collection.findOne({ _id: result.insertedId });
    return documentToUser(created!);
  }
}

export async function updateUserRole(
  userId: string,
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER'
): Promise<User | null> {
  const db = await connectToDatabase();
  const collection = db.collection<UserDocument>(COLLECTIONS.USERS);
  
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(userId);
  } catch {
    return null;
  }
  
  const result = await collection.findOneAndUpdate(
    { _id: objectId },
    { $set: { role, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  
  return result ? documentToUser(result) : null;
}
