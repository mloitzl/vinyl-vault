// Counter model for tracking record counts per tenant
// Supports incremental updates and reconciliation

export interface CounterDocument {
  _id: string; // Fixed as 'records'
  total: number;
  byUser: { [userId: string]: number }; // userId -> count
  byLocation: { [location: string]: number }; // location -> count
  updatedAt: Date;
}

export class CounterRepository {
  constructor(private db: import('mongodb').Db) {}

  /**
   * Increment counters for a new record.
   * Uses atomic $inc operations for consistency.
   */
  async increment(userId?: string, location?: string): Promise<void> {
    const update: any = {
      $inc: {
        total: 1,
      },
      $set: {
        updatedAt: new Date(),
      },
    };

    // Increment per-user counter
    if (userId) {
      update.$inc[`byUser.${userId}`] = 1;
    }

    // Increment per-location counter
    if (location) {
      update.$inc[`byLocation.${location}`] = 1;
    }

    await this.db.collection<CounterDocument>('counters').updateOne(
      { _id: 'records' },
      update,
      { upsert: true }
    );
  }

  /**
   * Decrement counters when a record is deleted or location changed.
   * Uses atomic $inc operations for consistency.
   */
  async decrement(userId?: string, location?: string): Promise<void> {
    const update: any = {
      $inc: {
        total: -1,
      },
      $set: {
        updatedAt: new Date(),
      },
    };

    // Decrement per-user counter
    if (userId) {
      update.$inc[`byUser.${userId}`] = -1;
    }

    // Decrement per-location counter
    if (location) {
      update.$inc[`byLocation.${location}`] = -1;
    }

    await this.db.collection<CounterDocument>('counters').updateOne(
      { _id: 'records' },
      update,
      { upsert: true }
    );
  }

  /**
   * Get count from cache based on filter criteria.
   * Returns the total count if no specific filter, otherwise per-user or per-location count.
   * For regex/complex filters, returns null to indicate fallback to countDocuments.
   */
  async getCount(filter: { userId?: string; location?: string; isRegexLocation?: boolean }): Promise<number | null> {
    const counters = await this.db.collection<CounterDocument>('counters').findOne({ _id: 'records' });

    if (!counters) {
      return null; // No counters yet, fallback to countDocuments
    }

    // For regex location filters, fallback to countDocuments
    if (filter.isRegexLocation) {
      return null;
    }

    // Per-user filter: return user-specific count
    if (filter.userId) {
      return counters.byUser?.[filter.userId] ?? 0;
    }

    // Per-location filter (exact match): return location-specific count
    if (filter.location) {
      return counters.byLocation?.[filter.location] ?? 0;
    }

    // No filter: return total count
    return counters.total ?? 0;
  }

  /**
   * Reconcile counters by recomputing from actual records collection.
   * Should be called during tenant initialization or manually for correction.
   * Non-blocking (fire-and-forget friendly).
   */
  async reconcile(): Promise<void> {
    try {
      const recordsCollection = this.db.collection('records');

      // Get total count
      const total = await recordsCollection.countDocuments({});

      // Aggregate counts by userId
      const userCounts = await recordsCollection
        .aggregate([
          {
            $group: {
              _id: '$userId',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const byUser: { [key: string]: number } = {};
      userCounts.forEach((doc: any) => {
        byUser[doc._id.toString()] = doc.count;
      });

      // Aggregate counts by location (excluding null/undefined)
      const locationCounts = await recordsCollection
        .aggregate([
          {
            $match: { location: { $exists: true, $ne: null } },
          },
          {
            $group: {
              _id: '$location',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const byLocation: { [key: string]: number } = {};
      locationCounts.forEach((doc: any) => {
        byLocation[doc._id] = doc.count;
      });

      // Update counters atomically
      await this.db.collection<CounterDocument>('counters').updateOne(
        { _id: 'records' },
        {
          $set: {
            total,
            byUser,
            byLocation,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (error) {
      // Log error but don't throw (reconciliation is non-critical)
      console.error('Counter reconciliation failed:', error);
    }
  }
}
