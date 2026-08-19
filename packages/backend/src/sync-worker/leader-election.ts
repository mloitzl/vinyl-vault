import { randomUUID } from 'crypto';
import type { Db } from 'mongodb';
const COLLECTION = 'sync_state';
const LEADER_DOC_ID = 'syncWorkerLeader';

export const LEADER_LEASE_DURATION_MS = 60_000;
export const LEADER_LEASE_INTERVAL_MS = 20_000;
export const LEADER_LEASE_RETRY_DELAY_MS = 5_000;

interface LeaderLeaseDoc {
  _id: string;
  ownerId: string;
  leaseUntil: Date;
  acquiredAt: Date;
  updatedAt: Date;
}

function extractFindOneAndUpdateDoc<T>(result: unknown): T | null {
  if (!result) {
    return null;
  }

  if (typeof result === 'object' && result !== null && 'value' in result) {
    return (result as { value: T | null }).value;
  }

  return result as T;
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: number }).code === 11000;
}

export function getSyncWorkerIdentity(): string {
  return process.env.POD_NAME ?? process.env.HOSTNAME ?? randomUUID();
}

export async function acquireLeaderLease(
  registryDb: Db,
  ownerId: string,
  now = new Date(),
  leaseMs = LEADER_LEASE_DURATION_MS,
): Promise<boolean> {
  const leaseUntil = new Date(now.getTime() + leaseMs);

  try {
    const result = await registryDb.collection<LeaderLeaseDoc>(COLLECTION).findOneAndUpdate(
      {
        _id: LEADER_DOC_ID,
        $or: [
          { ownerId },
          { leaseUntil: { $lte: now } },
          { leaseUntil: { $exists: false } },
        ],
      },
      {
        $set: {
          ownerId,
          leaseUntil,
          updatedAt: now,
        },
        $setOnInsert: {
          acquiredAt: now,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      },
    );

    const doc = extractFindOneAndUpdateDoc<LeaderLeaseDoc>(result);
    if (doc?.ownerId === ownerId) {
      return true;
    }
  } catch (err) {
    if (!isDuplicateKeyError(err)) {
      throw err;
    }
  }

  return false;
}

export async function renewLeaderLease(
  registryDb: Db,
  ownerId: string,
  now = new Date(),
  leaseMs = LEADER_LEASE_DURATION_MS,
): Promise<boolean> {
  const leaseUntil = new Date(now.getTime() + leaseMs);

  const result = await registryDb.collection<LeaderLeaseDoc>(COLLECTION).findOneAndUpdate(
    {
      _id: LEADER_DOC_ID,
      ownerId,
    },
    {
      $set: {
        leaseUntil,
        updatedAt: now,
      },
    },
    {
      returnDocument: 'after',
    },
  );

  const doc = extractFindOneAndUpdateDoc<LeaderLeaseDoc>(result);
  return doc?.ownerId === ownerId;
}

export async function releaseLeaderLease(registryDb: Db, ownerId: string): Promise<void> {
  await registryDb.collection<LeaderLeaseDoc>(COLLECTION).deleteOne({
    _id: LEADER_DOC_ID,
    ownerId,
  });
}
