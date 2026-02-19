// Record Repository Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { RecordRepository, type CreateRecordInput } from '../models/record.js';

describe('RecordRepository', () => {
  let client: MongoClient;
  let db: Db;
  let repository: RecordRepository;

  beforeEach(async () => {
    // Use a test database
    client = new MongoClient(process.env.MONGODB_URI_BASE || 'mongodb://localhost:27017', {
      maxPoolSize: 5, // Limit pool size for tests
    });
    await client.connect();
    db = client.db(`vinylvault_test_${Date.now()}`);
    repository = new RecordRepository(db);

    // Create indexes
    await repository.createIndexes();
  });

  afterEach(async () => {
    // Clean up test database
    await db.dropDatabase();
    await client.close();
  });

  describe('create', () => {
    it('should create a record with all fields', async () => {
      const input: CreateRecordInput = {
        releaseId: new ObjectId().toString(),
        userId: new ObjectId().toString(),
        purchaseDate: '2025-12-10T00:00:00.000Z',
        price: 29.99,
        condition: 'Mint',
        location: 'Shelf A1',
        notes: 'Limited edition pressing',
      };

      const record = await repository.create(input);

      expect(record._id).toBeInstanceOf(ObjectId);
      expect(record.releaseId).toBeInstanceOf(ObjectId);
      expect(record.userId).toBeInstanceOf(ObjectId);
      expect(record.purchaseDate).toBeInstanceOf(Date);
      expect(record.price).toBe(29.99);
      expect(record.condition).toBe('Mint');
      expect(record.location).toBe('Shelf A1');
      expect(record.notes).toBe('Limited edition pressing');
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a record with minimal fields', async () => {
      const input: CreateRecordInput = {
        releaseId: new ObjectId().toString(),
        userId: new ObjectId().toString(),
      };

      const record = await repository.create(input);

      expect(record._id).toBeInstanceOf(ObjectId);
      expect(record.releaseId).toBeInstanceOf(ObjectId);
      expect(record.userId).toBeInstanceOf(ObjectId);
      expect(record.purchaseDate).toBeUndefined();
      expect(record.price).toBeUndefined();
      expect(record.condition).toBeUndefined();
      expect(record.location).toBeUndefined();
      expect(record.notes).toBeUndefined();
    });
  });

  describe('findById', () => {
    it('should find a record by ID', async () => {
      const input: CreateRecordInput = {
        releaseId: new ObjectId().toString(),
        userId: new ObjectId().toString(),
        condition: 'Very Good',
      };

      const created = await repository.create(input);
      const found = await repository.findById(created._id.toString());

      expect(found).not.toBeNull();
      expect(found!._id.toString()).toBe(created._id.toString());
      expect(found!.condition).toBe('Very Good');
    });

    it('should return null for non-existent ID', async () => {
      const found = await repository.findById(new ObjectId().toString());
      expect(found).toBeNull();
    });

    it('should return null for invalid ID', async () => {
      const found = await repository.findById('invalid-id');
      expect(found).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should find records with pagination', async () => {
      const userId = new ObjectId().toString();

      // Create 5 records
      for (let i = 0; i < 5; i++) {
        await repository.create({
          releaseId: new ObjectId().toString(),
          userId,
          notes: `Record ${i}`,
        });
      }

      const result = await repository.findMany({ userId }, { first: 3 });

      expect(result.edges).toHaveLength(3);
      expect(result.totalCount).toBe(5);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it('should filter by location', async () => {
      const userId = new ObjectId().toString();

      await repository.create({
        releaseId: new ObjectId().toString(),
        userId,
        location: 'Shelf A',
      });

      await repository.create({
        releaseId: new ObjectId().toString(),
        userId,
        location: 'Shelf B',
      });

      const result = await repository.findMany({ userId, location: 'Shelf A' });

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].node.location).toBe('Shelf A');
    });

    it('should support cursor-based pagination', async () => {
      const userId = new ObjectId().toString();

      // Create 3 records
      for (let i = 0; i < 3; i++) {
        await repository.create({
          releaseId: new ObjectId().toString(),
          userId,
        });
      }

      // Get first page
      const firstPage = await repository.findMany({ userId }, { first: 2 });
      expect(firstPage.edges).toHaveLength(2);
      expect(firstPage.pageInfo.hasNextPage).toBe(true);

      // Get second page using cursor
      const secondPage = await repository.findMany(
        { userId },
        { first: 2, after: firstPage.pageInfo.endCursor }
      );
      expect(secondPage.edges).toHaveLength(1);
      expect(secondPage.pageInfo.hasNextPage).toBe(false);
    });
  });

  describe('update', () => {
    it('should update record fields', async () => {
      const created = await repository.create({
        releaseId: new ObjectId().toString(),
        userId: new ObjectId().toString(),
        condition: 'Good',
        price: 15.0,
      });

      const updated = await repository.update(created._id.toString(), {
        id: created._id.toString(),
        condition: 'Very Good',
        price: 20.0,
        notes: 'Cleaned and restored',
      });

      expect(updated).not.toBeNull();
      expect(updated!.condition).toBe('Very Good');
      expect(updated!.price).toBe(20.0);
      expect(updated!.notes).toBe('Cleaned and restored');
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(updated!.createdAt.getTime());
    });

    it('should return null for non-existent record', async () => {
      const result = await repository.update(new ObjectId().toString(), {
        id: new ObjectId().toString(),
        condition: 'Mint',
      });

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a record', async () => {
      const created = await repository.create({
        releaseId: new ObjectId().toString(),
        userId: new ObjectId().toString(),
      });

      const deleted = await repository.delete(created._id.toString());
      expect(deleted).toBe(true);

      const found = await repository.findById(created._id.toString());
      expect(found).toBeNull();
    });

    it('should return false for non-existent record', async () => {
      const deleted = await repository.delete(new ObjectId().toString());
      expect(deleted).toBe(false);
    });
  });

  describe('findByUserId', () => {
    it('should find all records for a user', async () => {
      const userId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();

      // Create records for first user
      await repository.create({
        releaseId: new ObjectId().toString(),
        userId,
      });

      await repository.create({
        releaseId: new ObjectId().toString(),
        userId,
      });

      // Create record for other user
      await repository.create({
        releaseId: new ObjectId().toString(),
        userId: otherUserId,
      });

      const records = await repository.findByUserId(userId);

      expect(records).toHaveLength(2);
      records.forEach((record) => {
        expect(record.userId.toString()).toBe(userId);
      });
    });

    it('should return empty array for user with no records', async () => {
      const records = await repository.findByUserId(new ObjectId().toString());
      expect(records).toHaveLength(0);
    });
  });
});
