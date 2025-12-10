// Release model types and repository
// TODO: Implement release data access

import { ObjectId } from 'mongodb';

export interface Track {
  position?: string;
  title: string;
  duration?: string;
}

export interface ReleaseDocument {
  _id: ObjectId;
  barcode: string;
  artist: string;
  title: string;
  year?: number;
  format?: string;
  genre?: string[];
  style?: string[];
  label?: string;
  country?: string;
  coverImageUrl?: string;
  trackList?: Track[];
  externalId?: string;
  source: 'DISCOGS' | 'MUSICBRAINZ' | 'MANUAL';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReleaseInput {
  barcode: string;
  artist: string;
  title: string;
  year?: number;
  format?: string;
  genre?: string[];
  style?: string[];
  label?: string;
  country?: string;
  coverImageUrl?: string;
  trackList?: Track[];
  externalId?: string;
  source: 'DISCOGS' | 'MUSICBRAINZ' | 'MANUAL';
}

export class ReleaseRepository {
  constructor(private db: import('mongodb').Db) {}

  /**
   * Create or update a release in the tenant database.
   * Used for caching external API results.
   */
  async upsert(input: CreateReleaseInput): Promise<ReleaseDocument> {
    const now = new Date();
    const release: Omit<ReleaseDocument, '_id'> = {
      barcode: input.barcode,
      artist: input.artist,
      title: input.title,
      year: input.year,
      format: input.format,
      genre: input.genre || [],
      style: input.style || [],
      label: input.label,
      country: input.country,
      coverImageUrl: input.coverImageUrl,
      trackList: input.trackList || [],
      externalId: input.externalId,
      source: input.source,
      createdAt: now,
      updatedAt: now,
    };

    // Upsert by barcode + externalId + source to avoid duplicates
    const filter: any = { barcode: input.barcode, source: input.source };
    if (input.externalId) {
      filter.externalId = input.externalId;
    }

    const result = await this.db
      .collection<ReleaseDocument>('releases')
      .findOneAndUpdate(
        filter,
        { $set: { ...release, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true, returnDocument: 'after' }
      );

    return result!;
  }

  /**
   * Find a release by ID.
   */
  async findById(id: string): Promise<ReleaseDocument | null> {
    try {
      const objectId = new ObjectId(id);
      return await this.db.collection<ReleaseDocument>('releases').findOne({ _id: objectId });
    } catch {
      return null;
    }
  }

  /**
   * Find releases by barcode.
   */
  async findByBarcode(barcode: string): Promise<ReleaseDocument[]> {
    return await this.db
      .collection<ReleaseDocument>('releases')
      .find({ barcode })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Find releases by external ID and source.
   */
  async findByExternalId(
    externalId: string,
    source: 'DISCOGS' | 'MUSICBRAINZ'
  ): Promise<ReleaseDocument | null> {
    return await this.db.collection<ReleaseDocument>('releases').findOne({ externalId, source });
  }

  /**
   * Bulk upsert multiple releases.
   * Used when caching multiple releases from barcode lookup.
   */
  async bulkUpsert(inputs: CreateReleaseInput[]): Promise<number> {
    if (inputs.length === 0) return 0;

    const operations = inputs.map((input) => {
      const now = new Date();
      const release: Omit<ReleaseDocument, '_id'> = {
        barcode: input.barcode,
        artist: input.artist,
        title: input.title,
        year: input.year,
        format: input.format,
        genre: input.genre || [],
        style: input.style || [],
        label: input.label,
        country: input.country,
        coverImageUrl: input.coverImageUrl,
        trackList: input.trackList || [],
        externalId: input.externalId,
        source: input.source,
        createdAt: now,
        updatedAt: now,
      };

      const filter: any = { barcode: input.barcode, source: input.source };
      if (input.externalId) {
        filter.externalId = input.externalId;
      }

      return {
        updateOne: {
          filter,
          update: { $set: { ...release, updatedAt: now }, $setOnInsert: { createdAt: now } },
          upsert: true,
        },
      };
    });

    const result = await this.db.collection<ReleaseDocument>('releases').bulkWrite(operations);
    return result.upsertedCount + result.modifiedCount;
  }

  /**
   * Create indexes for release queries.
   * Should be called during tenant database initialization.
   */
  async createIndexes(): Promise<void> {
    const collection = this.db.collection<ReleaseDocument>('releases');

    // Index for barcode lookups
    await collection.createIndex({ barcode: 1 }, { name: 'release_barcode' });

    // Index for external ID + source (unique combination)
    await collection.createIndex(
      { externalId: 1, source: 1 },
      { name: 'release_external_id_source', unique: true, sparse: true }
    );

    // Text index for search on artist and title
    await collection.createIndex(
      { artist: 'text', title: 'text' },
      { name: 'release_search_text' }
    );
  }
}
