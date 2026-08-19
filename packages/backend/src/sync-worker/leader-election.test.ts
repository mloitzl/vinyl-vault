import { describe, expect, it, vi } from 'vitest';
import type { Db } from 'mongodb';
import {
  acquireLeaderLease,
  getSyncWorkerIdentity,
  releaseLeaderLease,
  renewLeaderLease,
} from './leader-election.js';

describe('sync worker leader election', () => {
  it('derives a stable identity from the pod hostname', () => {
    expect(getSyncWorkerIdentity()).toBeTruthy();
  });

  it('acquires the lease when the registry collection allows it', async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue({ value: { ownerId: 'sync-worker-1' } });
    const db = {
      collection: vi.fn().mockReturnValue({ findOneAndUpdate }),
    } as unknown as Db;

    await expect(acquireLeaderLease(db, 'sync-worker-1', new Date('2026-08-19T00:00:00.000Z'), 1000)).resolves.toBe(true);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'syncWorkerLeader',
        $or: expect.any(Array),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          ownerId: 'sync-worker-1',
        }),
      }),
      expect.objectContaining({
        upsert: true,
        returnDocument: 'after',
      }),
    );
  });

  it('does not renew the lease for a different owner', async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue({ value: null });
    const db = {
      collection: vi.fn().mockReturnValue({ findOneAndUpdate }),
    } as unknown as Db;

    await expect(renewLeaderLease(db, 'sync-worker-2')).resolves.toBe(false);
  });

  it('releases the lease for the current owner', async () => {
    const deleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });
    const db = {
      collection: vi.fn().mockReturnValue({ deleteOne }),
    } as unknown as Db;

    await releaseLeaderLease(db, 'sync-worker-3');
    expect(deleteOne).toHaveBeenCalledWith({
      _id: 'syncWorkerLeader',
      ownerId: 'sync-worker-3',
    });
  });
});
