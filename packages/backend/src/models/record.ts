// Record model types and repository
// TODO: Implement record data access

import { ObjectId } from 'mongodb';
import { CounterRepository } from './counter.js';
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
  // Embedded release fields for single-collection Atlas Search (populated at write time)
  releaseArtist?: string;
  releaseTitle?: string;
  releaseYear?: number;
  releaseFormat?: string;
  releaseGenre?: string[];
  releaseStyle?: string[];
  releaseLabel?: string;
  releaseCountry?: string;
}

/** Subset of release fields copied into a record document for search/faceting. */
export interface RecordSearchFields {
  releaseArtist?: string;
  releaseTitle?: string;
  releaseYear?: number;
  releaseFormat?: string;
  releaseGenre?: string[];
  releaseStyle?: string[];
  releaseLabel?: string;
  releaseCountry?: string;
}

export interface CreateRecordInput {
  releaseId: string;
  userId: string;
  purchaseDate?: string;
  price?: number;
  condition?: string;
  location?: string;
  notes?: string;
  searchFields?: RecordSearchFields;
}

export interface UpdateRecordInput {
  id: string;
  purchaseDate?: string;
  price?: number;
  condition?: string;
  location?: string;
  notes?: string;
  searchFields?: RecordSearchFields;
}

export interface RecordFilter {
  userId?: string;
  artist?: string;
  title?: string;
  year?: number;
  format?: string;
  genre?: string;
  location?: string;
  search?: string;
}

export interface RecordSearchFilter {
  genre?:     string[];
  format?:    string[];
  condition?: string[];
  location?:  string[];
  country?:   string[];
}

export interface SearchFacetBucket {
  value: string;
  count: number;
}

export interface SearchFacets {
  genre:     SearchFacetBucket[];
  format:    SearchFacetBucket[];
  condition: SearchFacetBucket[];
  location:  SearchFacetBucket[];
  country:   SearchFacetBucket[];
}

export interface SearchRecordsResult {
  edges: Array<{ cursor: string; node: RecordDocument }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string;
    endCursor?: string;
  };
  totalCount: number;
  facets: SearchFacets;
}

export interface PaginationOptions {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
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
      ...input.searchFields,
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

    // Determine direction: backward pagination takes priority if `last`/`before` are set
    const isBackward = !!pagination.last || !!pagination.before;
    const limit = Math.min(
      isBackward ? (pagination.last || 20) : (pagination.first || 20),
      100
    );

    // Build MongoDB query
    const query: any = {};
    let isRegexLocation = false;

    if (filter.userId) {
      query.userId = new ObjectId(filter.userId);
    }

    if (filter.location) {
      query.location = { $regex: filter.location, $options: 'i' };
      isRegexLocation = true;
    }

    if (filter.search) {
      query.$text = { $search: filter.search };
    }

    // Release-level filters — query embedded fields directly (no join needed).
    if (filter.artist) query.releaseArtist = { $regex: filter.artist, $options: 'i' };
    if (filter.title)  query.releaseTitle  = { $regex: filter.title,  $options: 'i' };
    if (filter.year)   query.releaseYear   = filter.year;
    if (filter.format) query.releaseFormat = filter.format;
    // releaseGenre is an array; MongoDB matches if the value is an element of it
    if (filter.genre)  query.releaseGenre  = filter.genre;

    // Forward pagination: records after cursor
    let afterCursorApplied = false;
    if (!isBackward && pagination.after) {
      try {
        const cursorId = new ObjectId(pagination.after);
        query._id = { $gt: cursorId };
        afterCursorApplied = true;
      } catch {
        // Invalid cursor, ignore
      }
    }

    // Backward pagination: records before cursor
    let beforeCursorApplied = false;
    if (isBackward && pagination.before) {
      try {
        const cursorId = new ObjectId(pagination.before);
        query._id = { $lt: cursorId };
        beforeCursorApplied = true;
      } catch {
        // Invalid cursor, ignore
      }
    }

    const sortDir = isBackward ? -1 : 1;

    // Fetch limit + 1 to determine has{Next,Previous}Page
    let records: RecordDocument[] = [];
    try {
      records = await collection
        .find(query)
        .sort({ _id: sortDir })
        .limit(limit + 1)
        .toArray();
    } catch (error: any) {
      // If text search fails due to missing index, retry without text search
      if (error.errmsg?.includes('text index') && filter.search) {
        logger.warn('Text search index not ready, retrying without search');
        delete query.$text;
        records = await collection
          .find(query)
          .sort({ _id: sortDir })
          .limit(limit + 1)
          .toArray();
      } else {
        throw error;
      }
    }

    const hasExtraPage = records.length > limit;
    const pageItems = records.slice(0, limit);

    // Backward pagination returns items in reverse order — restore natural order
    if (isBackward) {
      pageItems.reverse();
    }

    const edges = pageItems.map((record) => ({
      cursor: record._id.toString(),
      node: record,
    }));

    const hasPreviousPage = isBackward ? hasExtraPage : afterCursorApplied;
    const hasNextPage = isBackward ? beforeCursorApplied : hasExtraPage;

    // Try to use cached counters, fallback to countDocuments for complex queries
    let totalCount: number;
    const cachedCount = await this.counterRepo.getCount({
      userId: filter.userId,
      location: filter.location,
      isRegexLocation,
    });

    if (cachedCount !== null) {
      totalCount = cachedCount;
    } else {
      totalCount = await collection.countDocuments(query);
    }

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
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
      if (input.searchFields) Object.assign(updateData, input.searchFields);

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
   * Full-text search using Atlas Search with faceted refiners.
   * Falls back to a regex findMany() with empty facets on non-Atlas clusters.
   */
  async search(
    userId: string,
    query: string,
    filter: RecordSearchFilter = {},
    pagination: { first?: number; after?: string } = {}
  ): Promise<SearchRecordsResult> {
    const emptyFacets: SearchFacets = { genre: [], format: [], condition: [], location: [], country: [] };
    const limit = Math.min(pagination.first ?? 20, 100);

    try {
      return await this._atlasSearch(userId, query, filter, limit, pagination.after);
    } catch (err: any) {
      // Atlas Search not available on this cluster — fall back to regex search.
      if (
        err?.codeName === 'AtlasError' ||
        err?.message?.includes('$search') ||
        err?.message?.includes('search index')
      ) {
        logger.warn({ err }, 'Atlas Search unavailable, falling back to regex search');
        const fallback = await this.findMany(
          { userId, search: query, genre: filter.genre?.[0], format: filter.format?.[0] },
          { first: limit, after: pagination.after }
        );
        return { ...fallback, facets: emptyFacets };
      }
      throw err;
    }
  }

  private async _atlasSearch(
    userId: string,
    query: string,
    filter: RecordSearchFilter,
    limit: number,
    after?: string
  ): Promise<SearchRecordsResult> {
    const collection = this.db.collection<RecordDocument>('records');
    const userObjectId = new ObjectId(userId);

    // Build compound filter clauses for active facet selections
    const filterClauses: unknown[] = [
      { equals: { path: 'userId', value: userObjectId } },
    ];
    if (filter.genre?.length)     filterClauses.push({ in: { path: 'releaseGenre',   value: filter.genre } });
    if (filter.format?.length)    filterClauses.push({ in: { path: 'releaseFormat',  value: filter.format } });
    if (filter.condition?.length) filterClauses.push({ in: { path: 'condition',      value: filter.condition } });
    if (filter.location?.length)  filterClauses.push({ in: { path: 'location',       value: filter.location } });
    if (filter.country?.length)   filterClauses.push({ in: { path: 'releaseCountry', value: filter.country } });

    // The search operator applied to text fields
    const searchOperator = query.trim()
      ? {
          text: {
            query,
            path: ['releaseArtist', 'releaseTitle', 'releaseLabel', 'notes'],
            fuzzy: { maxEdits: 1 },
          },
        }
      : { wildcard: { query: '*', path: ['releaseArtist', 'releaseTitle'], allowAnalyzedField: true } };

    const searchStage = {
      $search: {
        index: 'records_search',
        facet: {
          operator: {
            compound: {
              must:   [searchOperator],
              filter: filterClauses,
            },
          },
          facets: {
            genreFacet:     { type: 'string', path: 'releaseGenre',   numBuckets: 15 },
            formatFacet:    { type: 'string', path: 'releaseFormat',  numBuckets: 10 },
            conditionFacet: { type: 'string', path: 'condition',      numBuckets: 10 },
            locationFacet:  { type: 'string', path: 'location',       numBuckets: 20 },
            countryFacet:   { type: 'string', path: 'releaseCountry', numBuckets: 20 },
          },
        },
      },
    };

    // Resolve cursor offset — Atlas Search does not support keyset pagination;
    // we use skip/limit which is acceptable for typical collection sizes.
    let skip = 0;
    if (after) {
      // after is a base64-encoded offset ("cursor:N")
      try {
        const decoded = Buffer.from(after, 'base64').toString('utf8');
        const match = decoded.match(/^cursor:(\d+)$/);
        if (match) skip = parseInt(match[1], 10);
      } catch {
        // ignore invalid cursor
      }
    }

    const pipeline: unknown[] = [
      searchStage,
      { $skip: skip },
      { $limit: limit + 1 },
      {
        $project: {
          _id: 1,
          releaseId: 1,
          userId: 1,
          purchaseDate: 1,
          price: 1,
          condition: 1,
          location: 1,
          notes: 1,
          createdAt: 1,
          updatedAt: 1,
          releaseArtist: 1,
          releaseTitle: 1,
          releaseYear: 1,
          releaseFormat: 1,
          releaseGenre: 1,
          releaseStyle: 1,
          releaseLabel: 1,
          releaseCountry: 1,
          searchMeta: '$$SEARCH_META',
        },
      },
    ];

    const rows = await collection.aggregate<RecordDocument & { searchMeta?: any }>(pipeline as any[]).toArray();

    const hasNextPage = rows.length > limit;
    const pageItems = rows.slice(0, limit);

    // Extract facet metadata from the first document (Atlas attaches it to every row)
    const meta = rows[0]?.searchMeta?.facet ?? {};
    const toBuckets = (facetKey: string): SearchFacetBucket[] =>
      (meta[facetKey]?.buckets ?? []).map((b: any) => ({ value: b._id as string, count: b.count as number }));

    const facets: SearchFacets = {
      genre:     toBuckets('genreFacet'),
      format:    toBuckets('formatFacet'),
      condition: toBuckets('conditionFacet'),
      location:  toBuckets('locationFacet'),
      country:   toBuckets('countryFacet'),
    };

    // totalCount is stored in searchMeta.count.lowerBound (Atlas provides a lower bound estimate)
    const totalCount: number = rows[0]?.searchMeta?.count?.lowerBound ?? pageItems.length;

    const makeCursor = (offset: number) => Buffer.from(`cursor:${offset}`).toString('base64');

    const edges = pageItems.map((record, i) => ({
      cursor: makeCursor(skip + i + 1),
      node: record,
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: skip > 0,
        startCursor: edges[0]?.cursor,
        endCursor:   edges[edges.length - 1]?.cursor,
      },
      totalCount,
      facets,
    };
  }

  /**
   * Create Atlas Search index for full-text search and faceted filtering.
   * Submitted asynchronously — Atlas builds it in the background.
   * Safe to call on existing tenants: skipped if the index already exists.
   */
  async createSearchIndexes(): Promise<void> {
    const collection = this.db.collection<RecordDocument>('records');
    const INDEX_NAME = 'records_search';

    try {
      const existing = await collection.listSearchIndexes(INDEX_NAME).toArray();
      if (existing.length > 0) return;

      await collection.createSearchIndex({
        name: INDEX_NAME,
        definition: {
          mappings: {
            dynamic: false,
            fields: {
              // Full-text search fields
              releaseArtist: { type: 'string', analyzer: 'lucene.standard' },
              releaseTitle:  { type: 'string', analyzer: 'lucene.standard' },
              releaseLabel:  { type: 'string', analyzer: 'lucene.standard' },
              notes:         { type: 'string', analyzer: 'lucene.standard' },
              // Facet fields (string)
              releaseFormat:  { type: 'stringFacet' },
              releaseGenre:   { type: 'stringFacet' },
              releaseStyle:   { type: 'stringFacet' },
              releaseCountry: { type: 'stringFacet' },
              condition:      { type: 'stringFacet' },
              location:       { type: 'stringFacet' },
              // Facet field (number)
              releaseYear: { type: 'numberFacet' },
            },
          },
        },
      });
      logger.info({ collection: 'records' }, 'Atlas Search index submitted');
    } catch (error) {
      logger.warn({ err: error }, 'Could not create Atlas Search index for records (non-Atlas cluster?)');
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
