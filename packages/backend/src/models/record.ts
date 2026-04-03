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
  releaseTrackTitles?: string[];
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
  releaseTrackTitles?: string[];
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
  artist?:    string[];
  title?:     string[];
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
  artist:    SearchFacetBucket[];
  title:     SearchFacetBucket[];
  genre:     SearchFacetBucket[];
  format:    SearchFacetBucket[];
  condition: SearchFacetBucket[];
  location:  SearchFacetBucket[];
  country:   SearchFacetBucket[];
}

export interface SearchHighlightText {
  value: string;
  type: 'hit' | 'text';
}

export interface SearchHighlight {
  path: string;
  texts: SearchHighlightText[];
  score?: number;
}

export interface SearchRecordsResult {
  edges: Array<{ cursor: string; node: RecordDocument; highlights: SearchHighlight[] }>;
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
    const emptyFacets: SearchFacets = { artist: [], title: [], genre: [], format: [], condition: [], location: [], country: [] };
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
        return {
          edges: fallback.edges.map((e) => ({ ...e, highlights: [] })),
          pageInfo: fallback.pageInfo,
          totalCount: fallback.totalCount,
          facets: emptyFacets,
        };
      }
      throw err;
    }
  }

  private async _atlasSearch(
    _userId: string,
    query: string,
    filter: RecordSearchFilter,
    limit: number,
    after?: string
  ): Promise<SearchRecordsResult> {
    const collection = this.db.collection<RecordDocument>('records');

    // Build a post-search $match for active facet selections.
    // stringFacet fields can't be used as filter operators inside $search,
    // so we apply them as a regular MongoDB $match after $search.
    const matchFilter: Record<string, unknown> = {};
    if (filter.artist?.length)    matchFilter.releaseArtist  = { $in: filter.artist };
    if (filter.title?.length)     matchFilter.releaseTitle   = { $in: filter.title };
    if (filter.genre?.length)     matchFilter.releaseGenre   = { $in: filter.genre };
    if (filter.format?.length)    matchFilter.releaseFormat  = { $in: filter.format };
    if (filter.condition?.length) matchFilter.condition      = { $in: filter.condition };
    if (filter.location?.length)  matchFilter.location       = { $in: filter.location };
    if (filter.country?.length)   matchFilter.releaseCountry = { $in: filter.country };
    const hasMatchFilter = Object.keys(matchFilter).length > 0;

    // Build the Atlas Search text operator from the query string.
    // Supports plain text (fuzzy), "quoted phrases", +must, and -mustNot syntax.
    const trimmed = query.trim();
    const searchOperator = buildAtlasSearchOperator(trimmed);

    const searchStage = {
      $search: {
        index: 'records_search',
        // Highlights supported for text/phrase/compound operators (not wildcard match-all).
        ...(trimmed ? {
          highlight: { path: ['releaseArtist', 'releaseTitle', 'releaseTrackTitles'] },
        } : {}),
        facet: {
          operator: searchOperator,
          facets: {
            artistFacet:    { type: 'string', path: 'releaseArtist',  numBuckets: 20 },
            titleFacet:     { type: 'string', path: 'releaseTitle',   numBuckets: 20 },
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
      ...(hasMatchFilter ? [{ $match: matchFilter }] : []),
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
      artist:    toBuckets('artistFacet'),
      title:     toBuckets('titleFacet'),
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
      highlights: (record as any).searchHighlights ?? [],
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
              // Full-text search + facet fields (dual-mapped)
              releaseArtist: [
                { type: 'string',      analyzer: 'lucene.standard' },
                { type: 'stringFacet' },
              ],
              releaseTitle: [
                { type: 'string',      analyzer: 'lucene.standard' },
                { type: 'stringFacet' },
              ],
              releaseLabel:       { type: 'string', analyzer: 'lucene.standard' },
              notes:              { type: 'string', analyzer: 'lucene.standard' },
              releaseTrackTitles: { type: 'string', analyzer: 'lucene.standard' },
              // Genre and style: both searchable (string) and facetable (stringFacet)
              releaseGenre: [
                { type: 'string',      analyzer: 'lucene.standard' },
                { type: 'stringFacet' },
              ],
              releaseStyle: [
                { type: 'string',      analyzer: 'lucene.standard' },
                { type: 'stringFacet' },
              ],
              // Facet-only fields
              releaseFormat:  { type: 'stringFacet' },
              releaseCountry: { type: 'stringFacet' },
              condition:      { type: 'stringFacet' },
              location:       { type: 'stringFacet' },
              // Numeric facet
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

// ---------------------------------------------------------------------------
// Atlas Search query builder
// ---------------------------------------------------------------------------

const SEARCH_TEXT_PATHS = [
  'releaseArtist', 'releaseTitle', 'releaseLabel',
  'releaseGenre', 'releaseStyle', 'releaseTrackTitles', 'notes',
];

const WILDCARD_ALL = {
  wildcard: { query: '*', path: ['releaseArtist', 'releaseTitle'], allowAnalyzedField: true },
};

/**
 * Build an Atlas Search operator from a user-supplied query string.
 *
 * Supported syntax:
 *   "phrase"  – exact phrase (words in order)
 *   +term     – term MUST appear
 *   -term     – term MUST NOT appear
 *   term      – plain word (at least one should match, with fuzzy for long tokens)
 *
 * Plain queries (no quotes / +/-) are passed straight through as a fuzzy
 * `text` operator so behaviour is identical to before this change.
 */
export function buildAtlasSearchOperator(rawQuery: string): unknown {
  const trimmed = rawQuery.trim();
  if (!trimmed) return WILDCARD_ALL;

  // Only enter advanced-parse mode when the query actually uses special syntax.
  const isAdvanced = /["']/.test(trimmed) || /(?:^|\s)[+-]\S/.test(trimmed);
  if (!isAdvanced) {
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      const useFuzzy = words[0].length >= 5;
      return {
        text: {
          query: words[0],
          path: SEARCH_TEXT_PATHS,
          ...(useFuzzy ? { fuzzy: { maxEdits: 1, prefixLength: 2 } } : {}),
        },
      };
    }
    // Multi-word plain query: require ALL words to appear (AND semantics).
    // Fuzzy is applied per-word so short tokens like "ZZ" or "Top" are matched
    // exactly rather than being loosely fuzzied against unrelated short words.
    return {
      compound: {
        must: words.map((word) => {
          const useFuzzy = word.length >= 5;
          return {
            text: {
              query: word,
              path: SEARCH_TEXT_PATHS,
              ...(useFuzzy ? { fuzzy: { maxEdits: 1, prefixLength: 2 } } : {}),
            },
          };
        }),
      },
    };
  }

  const must: unknown[] = [];
  const should: unknown[] = [];
  const mustNot: unknown[] = [];

  let i = 0;
  while (i < trimmed.length) {
    // skip whitespace
    while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
    if (i >= trimmed.length) break;

    const ch = trimmed[i];

    if (ch === '"' || ch === "'") {
      // Quoted phrase → exact phrase that MUST appear
      const quote = ch;
      i++;
      const start = i;
      while (i < trimmed.length && trimmed[i] !== quote) i++;
      const phrase = trimmed.slice(start, i);
      if (i < trimmed.length) i++; // skip closing quote
      if (phrase) must.push({ phrase: { query: phrase, path: SEARCH_TEXT_PATHS } });

    } else if (ch === '+') {
      // +term → MUST appear
      i++;
      const start = i;
      while (i < trimmed.length && !/\s/.test(trimmed[i])) i++;
      const term = trimmed.slice(start, i);
      if (term) {
        const useFuzzy = term.length >= 5;
        must.push({
          text: {
            query: term,
            path: SEARCH_TEXT_PATHS,
            ...(useFuzzy ? { fuzzy: { maxEdits: 1, prefixLength: 2 } } : {}),
          },
        });
      }

    } else if (ch === '-') {
      // -term → MUST NOT appear (only when - is at a token boundary)
      i++;
      const start = i;
      while (i < trimmed.length && !/\s/.test(trimmed[i])) i++;
      const term = trimmed.slice(start, i);
      if (term) mustNot.push({ text: { query: term, path: SEARCH_TEXT_PATHS } });

    } else {
      // Plain word → SHOULD (boosts relevance, at least one required when no must)
      const start = i;
      while (i < trimmed.length && !/\s/.test(trimmed[i])) i++;
      const term = trimmed.slice(start, i);
      if (term) {
        const useFuzzy = term.length >= 5;
        should.push({
          text: {
            query: term,
            path: SEARCH_TEXT_PATHS,
            ...(useFuzzy ? { fuzzy: { maxEdits: 1, prefixLength: 2 } } : {}),
          },
        });
      }
    }
  }

  if (must.length === 0 && should.length === 0 && mustNot.length === 0) {
    return WILDCARD_ALL;
  }

  // mustNot-only queries need a match-all anchor
  if (must.length === 0 && should.length === 0) {
    return { compound: { must: [WILDCARD_ALL], mustNot } };
  }

  const compound: Record<string, unknown[]> = {};
  if (must.length > 0)   compound.must    = must;
  if (should.length > 0) compound.should  = should;
  if (mustNot.length > 0) compound.mustNot = mustNot;

  return { compound };
}

