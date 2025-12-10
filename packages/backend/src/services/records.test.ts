// Records Service Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  createRecord,
  findRecordById,
  findRecords,
  updateRecord,
  deleteRecord,
  findRecordsByUserId,
  initializeRecordIndexes,
} from './records.js';
import { ReleaseRepository, type CreateReleaseInput } from '../models/release.js';

describe('Records Service', () => {
  let client: MongoClient;
  let db: Db;
  let releaseRepo: ReleaseRepository;

  beforeEach(async () => {
    // Use a test database
    client = new MongoClient(process.env.MONGODB_URI_BASE || 'mongodb://localhost:27017');
    await client.connect();
    db = client.db(`vinylvault_test_${Date.now()}`);
    releaseRepo = new ReleaseRepository(db);

    // Initialize indexes
    await initializeRecordIndexes(db);
    await releaseRepo.createIndexes();
  });

  afterEach(async () => {
    // Clean up test database
    await db.dropDatabase();
    await client.close();
  });

  describe('createRecord', () => {
    it('should create a record when release exists', async () => {
      // Create a release first
      const releaseInput: CreateReleaseInput = {
        barcode: '123456789',
        artist: 'Test Artist',
        title: 'Test Album',
        source: 'DISCOGS',
      };
      const release = await releaseRepo.upsert(releaseInput);

      const userId = new ObjectId().toString();
      const record = await createRecord(db, {
        releaseId: release._id.toString(),
        userId,
        condition: 'Mint',
        price: 25.0,
      });

      expect(record._id).toBeInstanceOf(ObjectId);
      expect(record.releaseId.toString()).toBe(release._id.toString());
      expect(record.userId.toString()).toBe(userId);
      expect(record.condition).toBe('Mint');
      expect(record.price).toBe(25.0);
    });

    it('should throw error when release does not exist', async () => {
      const nonExistentReleaseId = new ObjectId().toString();
      const userId = new ObjectId().toString();

      await expect(
        createRecord(db, {
          releaseId: nonExistentReleaseId,
          userId,
        })
      ).rejects.toThrow('Release with ID');
    });
  });

  describe('findRecordById', () => {
    it('should find an existing record', async () => {
      const release = await releaseRepo.upsert({
        barcode: '123456789',
        artist: 'Test Artist',
        title: 'Test Album',
        source: 'DISCOGS',
      });

      const created = await createRecord(db, {
        releaseId: release._id.toString(),
        userId: new ObjectId().toString(),
        notes: 'Test notes',
      });

      const found = await findRecordById(db, created._id.toString());

      expect(found).not.toBeNull();
      expect(found!._id.toString()).toBe(created._id.toString());
      expect(found!.notes).toBe('Test notes');
    });

    it('should return null for non-existent record', async () => {
      const found = await findRecordById(db, new ObjectId().toString());
      expect(found).toBeNull();
    });
  });

  describe('findRecords', () => {
    it('should find records with pagination', async () => {
      const release = await releaseRepo.upsert({
        barcode: '123456789',
        artist: 'Test Artist',
        title: 'Test Album',
        source: 'DISCOGS',
      });

      const userId = new ObjectId().toString();

      // Create 3 records
      for (let i = 0; i < 3; i++) {
        await createRecord(db, {
          releaseId: release._id.toString(),
          userId,
        });
      }

      const result = await findRecords(db, { userId }, { first: 2 });

      expect(result.edges).toHaveLength(2);
      expect(result.totalCount).toBe(3);
      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it('should filter by userId', async () => {
      const release = await releaseRepo.upsert({
        barcode: '123456789',
        artist: 'Test Artist',
        title: 'Test Album',
        source: 'DISCOGS',
      });

      const user1 = new ObjectId().toString();
      const user2 = new ObjectId().toString();

      await createRecord(db, { releaseId: release._id.toString(), userId: user1 });
      await createRecord(db, { releaseId: release._id.toString(), userId: user1 });
      await createRecord(db, { releaseId: release._id.toString(), userId: user2 });

      const result = await findRecords(db, { userId: user1 });

      expect(result.edges).toHaveLength(2);
      result.edges.forEach((edge) => {
        expect(edge.node.userId.toString()).toBe(user1);
      });
    });
  });

  describe('updateRecord', () => {
    it('should update an existing record', async () => {
      const release = await releaseRepo.upsert({
        barcode: '123456789',
        artist: 'Test Artist',
        title: 'Test Album',
        source: 'DISCOGS',
      });

      const created = await createRecord(db, {
        releaseId: release._id.toString(),
        userId: new ObjectId().toString(),
        condition: 'Good',
      });

      const updated = await updateRecord(db, {
        id: created._id.toString(),
        condition: 'Very Good',
        location: 'Shelf B2',
      });

      expect(updated).not.toBeNull();
      expect(updated!.condition).toBe('Very Good');
      expect(updated!.location).toBe('Shelf B2');
    });

    it('should throw error when record does not exist', async () => {
      await expect(
        updateRecord(db, {
          id: new ObjectId().toString(),
          condition: 'Mint',
        })
      ).rejects.toThrow('Record with ID');
    });
  });

  describe('deleteRecord', () => {
    it('should delete a record when user owns it', async () => {
      const release = await releaseRepo.upsert({
        barcode: '123456789',
        artist: 'Test Artist',
        title: 'Test Album',
        source: 'DISCOGS',
      });

      const userId = new ObjectId().toString();
      const created = await createRecord(db, {
        releaseId: release._id.toString(),
        userId,
      });

      const deleted = await deleteRecord(db, created._id.toString(), userId);

      expect(deleted).toBe(true);

      const found = await findRecordById(db, created._id.toString());
      expect(found).toBeNull();
    });

    it('should throw error when user does not own the record', async () => {
      const release = await releaseRepo.upsert({
        barcode: '123456789',
        artist: 'Test Artist',
        title: 'Test Album',
        source: 'DISCOGS',
      });

      const ownerUserId = new ObjectId().toString();
      const otherUserId = new ObjectId().toString();

      const created = await createRecord(db, {
        releaseId: release._id.toString(),
        userId: ownerUserId,
      });

      await expect(deleteRecord(db, created._id.toString(), otherUserId)).rejects.toThrow(
        'You can only delete your own records'
      );
    });

    it('should throw error when record does not exist', async () => {
      await expect(
        deleteRecord(db, new ObjectId().toString(), new ObjectId().toString())
      ).rejects.toThrow('Record with ID');
    });
  });

  describe('findRecordsByUserId', () => {
    it('should find all records for a user', async () => {
      const release = await releaseRepo.upsert({
        barcode: '123456789',
        artist: 'Test Artist',
        title: 'Test Album',
        source: 'DISCOGS',
      });

      const userId = new ObjectId().toString();

      await createRecord(db, { releaseId: release._id.toString(), userId });
      await createRecord(db, { releaseId: release._id.toString(), userId });

      const records = await findRecordsByUserId(db, userId);

      expect(records).toHaveLength(2);
      records.forEach((record) => {
        expect(record.userId.toString()).toBe(userId);
      });
    });

    it('should return empty array for user with no records', async () => {
      const records = await findRecordsByUserId(db, new ObjectId().toString());
      expect(records).toHaveLength(0);
    });
  });
});
