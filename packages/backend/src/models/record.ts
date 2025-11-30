// Record model types and repository
// TODO: Implement record data access

import { ObjectId } from 'mongodb';

export interface RecordDocument {
  _id: ObjectId;
  releaseId: ObjectId;
  userId: ObjectId;
  purchaseDate?: Date;
  price?: number;
  condition?: string;
  location?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecordInput {
  releaseId: string;
  userId: string;
  purchaseDate?: string;
  price?: number;
  condition?: string;
  location?: string;
  notes?: string;
}

// TODO: Implement RecordRepository class
