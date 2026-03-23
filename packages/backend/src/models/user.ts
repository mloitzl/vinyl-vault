// User model types and repository
// TODO: Implement user data access

import { ObjectId } from 'mongodb';

export interface UserSettings {
  spotifyPreview: boolean;
  allowFriendInvites: boolean;
  isCollectionPublic: boolean;
}

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

export interface CreateUserInput {
  githubId: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
}

// TODO: Implement UserRepository class
