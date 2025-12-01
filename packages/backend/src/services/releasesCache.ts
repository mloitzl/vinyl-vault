import { connectToDatabase } from '../db/connection.js';
import { COLLECTIONS } from '../db/collections.js';

export interface CachedRelease {
  id: string;
  barcode: string;
  artist: string;
  title: string;
  year?: number | null;
  format?: string | null;
  genre?: string[];
  style?: string[];
  label?: string | null;
  country?: string | null;
  coverImageUrl?: string | null;
  trackList?: any[];
  externalId?: string | null;
  source?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function findReleasesByBarcode(barcode: string): Promise<CachedRelease[]> {
  if (!barcode) return [];
  const db = await connectToDatabase();
  const col = db.collection<CachedRelease>(COLLECTIONS.RELEASES);
  // Find exact barcode matches. Stored documents contain `barcode` as normalized string.
  const docs = await col.find({ barcode }).toArray();
  return docs.map(({ _id, ...rest }) => rest as CachedRelease);
}

export async function upsertReleases(releases: CachedRelease[]): Promise<void> {
  if (!Array.isArray(releases) || releases.length === 0) return;
  const db = await connectToDatabase();
  const col = db.collection(COLLECTIONS.RELEASES);
  const now = new Date().toISOString();

  const ops = releases.map((r) => {
    const filter: any = {};
    if (r.source && r.externalId) {
      filter.source = r.source;
      filter.externalId = r.externalId;
    } else if (r.id) {
      filter.id = r.id;
    } else {
      // fallback to barcode + title
      filter.barcode = r.barcode;
      filter.title = r.title;
    }

    const doc = {
      ...r,
      createdAt: r.createdAt || now,
      updatedAt: now,
    };

    return {
      updateOne: {
        filter,
        update: { $set: doc },
        upsert: true,
      },
    };
  });

  if (ops.length > 0) {
    await col.bulkWrite(ops);
  }
}
