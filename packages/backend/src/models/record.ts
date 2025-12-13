// Record model types and repository
// TODO: Implement record data access

import { ObjectId } from 'mongodb';
import { CounterRepository } from './counter';
import { logger } from '../utils/logger.js';

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

export interface UpdateRecordInput {
  id: string;
  purchaseDate?: string;
  price?: number;
  condition?: string;
  location?: string;
  notes?: string;
}

export interface RecordFilter {
  userId?: string;
  artist?: string;
  title?: string;
  year?: number;
  format?: string;
  location?: string;
  search?: string;
}

export interface PaginationOptions {
  first?: number;
  after?: string;
}

export interface RecordConnection {
  edges: Array<{
    cursor: string;
    node: RecordDocument;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount: number;
}

export class RecordRepository {
  private counterRepo: CounterRepository;

  constructor(private db: import('mongodb').Db) {
    this.counterRepo = new CounterRepository(db);
  }

  /**
   * Create a new record in the tenant database.
   */
  async create(input: CreateRecordInput): Promise<RecordDocument> {
    const now = new Date();
    const record: Omit<RecordDocument, '_id'> = {
      releaseId: new ObjectId(input.releaseId),
      userId: new ObjectId(input.userId),
      purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
      price: input.price,
      condition: input.condition,
      location: input.location,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.db.collection<RecordDocument>('records').insertOne(record as any);

    // Increment counters
    await this.counterRepo.increment(input.userId, input.location);

    return {
      ...record,
      _id: result.insertedId,
    } as RecordDocument;
  }

  /**
   * Find a record by ID.
   */
  async findById(id: string): Promise<RecordDocument | null> {
    try {
      const objectId = new ObjectId(id);
      return await this.db.collection<RecordDocument>('records').findOne({ _id: objectId });
    } catch {
      return null;
    }
  }

  /**
   * Find records with pagination and filtering.
   * Supports cursor-based pagination for Relay compatibility.
   * Uses cached counters for fast totalCount calculation when possible.
   */
  async findMany(
    filter: RecordFilter = {},
    pagination: PaginationOptions = {}
  ): Promise<RecordConnection> {
    const collection = this.db.collection<RecordDocument>('records');
    const limit = Math.min(pagination.first || 20, 100);

    // Build MongoDB query
    const query: any = {};
    let isRegexLocation = false;

    if (filter.userId) {
      query.userId = new ObjectId(filter.userId);
    }

    if (filter.location) {
      query.location = { $regex: filter.location, $options: 'i' };
      isRegexLocation = true; // Mark as regex for counter fallback
    }

    // For artist, title, year, format - we need to join with releases
    // For now, we'll implement basic text search on notes/condition
    // Full filtering will be enhanced with aggregation pipeline
    if (filter.search) {
      query.$text = { $search: filter.search };
    }

    // Handle cursor-based pagination
    if (pagination.after) {
      try {
        const cursorId = new ObjectId(pagination.after);
        query._id = { $gt: cursorId };
      } catch {
        // Invalid cursor, ignore
      }
    }

    // Fetch records with limit + 1 to determine hasNextPage
    let records: RecordDocument[] = [];
    try {
      records = await collection
        .find(query)
        .sort({ _id: 1 })
        .limit(limit + 1)
        .toArray();
    } catch (error: any) {
      // If text search fails due to missing index, retry without text search
      if (error.errmsg?.includes('text index') && filter.search) {
        logger.warn('Text search index not ready, retrying without search');
        delete query.$text;
        records = await collection
          .find(query)
          .sort({ _id: 1 })
          .limit(limit + 1)
          .toArray();
      } else {
        throw error;
      }
    }

    const hasNextPage = records.length > limit;
    const edges = records.slice(0, limit).map((record) => ({
      cursor: record._id.toString(),
      node: record,
    }));

    // Try to use cached counters, fallback to countDocuments for complex queries
    let totalCount: number;
    const cachedCount = await this.counterRepo.getCount({
      userId: filter.userId,
      location: filter.location,
      isRegexLocation,
    });

    if (cachedCount !== null) {
      // Use cached counter
      totalCount = cachedCount;
    } else {
      // Fallback: use countDocuments for regex or other complex filters
      totalCount = await collection.countDocuments(query);
    }

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!pagination.after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount,
    };
  }

  /**
   * Update a record by ID.
   */
  async update(id: string, input: UpdateRecordInput): Promise<RecordDocument | null> {
    try {
      const objectId = new ObjectId(id);

      // Fetch the existing record to compare location changes
      const existingRecord = await this.db
        .collection<RecordDocument>('records')
        .findOne({ _id: objectId });

      if (!existingRecord) {
        return null;
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (input.purchaseDate !== undefined) {
        updateData.purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : null;
      }
      if (input.price !== undefined) updateData.price = input.price;
      if (input.condition !== undefined) updateData.condition = input.condition;
      if (input.location !== undefined) updateData.location = input.location;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const result = await this.db
        .collection<RecordDocument>('records')
        .findOneAndUpdate({ _id: objectId }, { $set: updateData }, { returnDocument: 'after' });

      // Update counters if location changed
      if (input.location !== undefined && input.location !== existingRecord.location) {
        // Decrement old location, increment new location
        await this.counterRepo.decrement(undefined, existingRecord.location);
        await this.counterRepo.increment(undefined, input.location);
      }

      return result || null;
    } catch {
      return null;
    }
  }

  /**
   * Delete a record by ID.
   */
  async delete(id: string): Promise<boolean> {
    try {
      const objectId = new ObjectId(id);

      // Fetch the record before deletion to get userId and location for counter update
      const record = await this.db.collection<RecordDocument>('records').findOne({ _id: objectId });

      if (!record) {
        return false;
      }

      const result = await this.db
        .collection<RecordDocument>('records')
        .deleteOne({ _id: objectId });

      if (result.deletedCount > 0) {
        // Decrement counters
        await this.counterRepo.decrement(record.userId.toString(), record.location);
      }

      return result.deletedCount > 0;
    } catch {
      return false;
    }
  }

  /**
   * Find records by user ID.
   */
  async findByUserId(userId: string): Promise<RecordDocument[]> {
    try {
      const userObjectId = new ObjectId(userId);
      return await this.db
        .collection<RecordDocument>('records')
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .toArray();
    } catch {
      return [];
    }
  }

  /**
   * Create text index for search functionality.
   * Should be called during tenant database initialization.
   */
  async createIndexes(): Promise<void> {
    const collection = this.db.collection<RecordDocument>('records');

    // Text index for search on notes and condition
    await collection.createIndex(
      { notes: 'text', condition: 'text', location: 'text' },
      { name: 'record_search_text' }
    );

    // Index for user queries
    await collection.createIndex({ userId: 1, createdAt: -1 }, { name: 'record_user_date' });

    // Index for location filtering
    await collection.createIndex({ location: 1 }, { name: 'record_location' });
  }
}
