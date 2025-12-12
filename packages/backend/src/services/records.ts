// Records service - business logic for record CRUD operations

import type { Db } from 'mongodb';
import {
  RecordRepository,
  type CreateRecordInput,
  type UpdateRecordInput,
  type RecordFilter,
  type PaginationOptions,
  type RecordDocument,
  type RecordConnection,
} from '../models/record.js';
import { ReleaseRepository } from '../models/release.js';

/**
 * Create a new record in the tenant database.
 * Validates that the release exists before creating the record.
 */
export async function createRecord(db: Db, input: CreateRecordInput): Promise<RecordDocument> {
  const recordRepo = new RecordRepository(db);
  const releaseRepo = new ReleaseRepository(db);

  // Parse releaseId - it could be either a MongoDB ObjectId or composite format (SOURCE‡externalId)
  let release: any = null;

  if (input.releaseId.includes('‡')) {
    // Composite ID format: SOURCE‡externalId (e.g., "DISCOGS‡12479585")
    const [source, externalId] = input.releaseId.split('‡');
    if (source === 'DISCOGS' || source === 'MUSICBRAINZ') {
      release = await releaseRepo.findByExternalId(externalId, source as 'DISCOGS' | 'MUSICBRAINZ');
    }
  } else {
    // MongoDB ObjectId format
    release = await releaseRepo.findById(input.releaseId);
  }

  if (!release) {
    throw new Error(`Release with ID ${input.releaseId} not found in tenant database`);
  }

  // Use the actual MongoDB _id for the releaseId in the record
  const recordInput = {
    ...input,
    releaseId: release._id.toString(),
  };

  // Create the record
  return await recordRepo.create(recordInput);
}

/**
 * Find a record by ID.
 */
export async function findRecordById(db: Db, id: string): Promise<RecordDocument | null> {
  const recordRepo = new RecordRepository(db);
  return await recordRepo.findById(id);
}

/**
 * Find records with pagination and filtering.
 * Supports cursor-based pagination for Relay compatibility.
 */
export async function findRecords(
  db: Db,
  filter: RecordFilter = {},
  pagination: PaginationOptions = {}
): Promise<RecordConnection> {
  const recordRepo = new RecordRepository(db);
  return await recordRepo.findMany(filter, pagination);
}

/**
 * Update a record by ID.
 * Only allows updating personal attributes (not releaseId or userId).
 */
export async function updateRecord(
  db: Db,
  input: UpdateRecordInput
): Promise<RecordDocument | null> {
  const recordRepo = new RecordRepository(db);

  // Verify record exists
  const existing = await recordRepo.findById(input.id);
  if (!existing) {
    throw new Error(`Record with ID ${input.id} not found`);
  }

  return await recordRepo.update(input.id, input);
}

/**
 * Delete a record by ID.
 */
export async function deleteRecord(db: Db, id: string, userId: string): Promise<boolean> {
  const recordRepo = new RecordRepository(db);

  // Verify record exists and belongs to the user
  const existing = await recordRepo.findById(id);
  if (!existing) {
    throw new Error(`Record with ID ${id} not found`);
  }

  // Check ownership - only allow deleting own records unless admin
  if (existing.userId.toString() !== userId) {
    throw new Error('You can only delete your own records');
  }

  return await recordRepo.delete(id);
}

/**
 * Find all records for a specific user.
 */
export async function findRecordsByUserId(db: Db, userId: string): Promise<RecordDocument[]> {
  const recordRepo = new RecordRepository(db);
  return await recordRepo.findByUserId(userId);
}

/**
 * Initialize indexes for the records collection.
 * Should be called when a new tenant database is created.
 */
export async function initializeRecordIndexes(db: Db): Promise<void> {
  const recordRepo = new RecordRepository(db);
  await recordRepo.createIndexes();
}
