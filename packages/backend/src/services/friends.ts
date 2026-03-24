import { ObjectId } from 'mongodb';
import { getRegistryDb } from '../db/registry.js';
import type { FriendRequestDocument } from '../models/friendRequest.js';
import type { UserDocument } from '../models/user.js';
import { ensureUserInTenant } from './tenants.js';

export type FriendshipStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS';

// Exact-match search by githubLogin or email.
// Returns empty array if the matched user has allowFriendInvites = false.
// Filters out the current user from results.
export async function searchUsers(
  query: string,
  currentUserId: ObjectId
): Promise<UserDocument[]> {
  const db = await getRegistryDb();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const user = await db.collection<UserDocument>('users').findOne({
    $and: [
      { _id: { $ne: currentUserId } },
      { $or: [{ githubLogin: trimmed }, { email: trimmed }] },
    ],
  });

  if (!user || !user.settings?.allowFriendInvites) return [];
  return [user];
}

export async function sendFriendRequest(
  requesterId: ObjectId,
  recipientId: ObjectId
): Promise<void> {
  const db = await getRegistryDb();

  // Guard: already friends (requester has VIEWER role in recipient's personal tenant)
  const recipientTenantId = `user_${recipientId.toString()}`;
  const existing = await db.collection('user_tenant_roles').findOne({
    userId: requesterId,
    tenantId: recipientTenantId,
    role: 'VIEWER',
  });
  if (existing) throw new Error('Already friends');

  try {
    await db.collection<Omit<FriendRequestDocument, '_id'>>('friend_requests').insertOne({
      requesterId,
      recipientId,
      createdAt: new Date(),
    } as FriendRequestDocument);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: number }).code === 11000) {
      throw new Error('Friend request already sent');
    }
    throw err;
  }
}

export async function getPendingRequests(
  recipientId: ObjectId
): Promise<FriendRequestDocument[]> {
  const db = await getRegistryDb();
  return db
    .collection<FriendRequestDocument>('friend_requests')
    .find({ recipientId })
    .sort({ createdAt: -1 })
    .toArray();
}

export async function getSentRequests(
  requesterId: ObjectId
): Promise<FriendRequestDocument[]> {
  const db = await getRegistryDb();
  return db
    .collection<FriendRequestDocument>('friend_requests')
    .find({ requesterId })
    .sort({ createdAt: -1 })
    .toArray();
}

// accept=true: grant symmetric VIEWER roles then delete request.
// Grants run first (idempotent upserts) so a failure before delete
// leaves the request intact and retryable.
// accept=false: just delete the request.
export async function respondToFriendRequest(
  requestId: ObjectId,
  accept: boolean,
  currentUserId: ObjectId
): Promise<void> {
  const db = await getRegistryDb();
  const request = await db
    .collection<FriendRequestDocument>('friend_requests')
    .findOne({ _id: requestId, recipientId: currentUserId });

  if (!request) throw new Error('Friend request not found');

  if (!accept) {
    await db.collection('friend_requests').deleteOne({ _id: requestId });
    return;
  }

  const requesterTenantId = `user_${request.requesterId.toString()}`;
  const recipientTenantId = `user_${request.recipientId.toString()}`;

  // Do grants first — they are idempotent upserts.
  // Only delete the request once both grants succeed.
  await Promise.all([
    ensureUserInTenant(request.requesterId, recipientTenantId, 'VIEWER'),
    ensureUserInTenant(request.recipientId, requesterTenantId, 'VIEWER'),
  ]);
  await db.collection('friend_requests').deleteOne({ _id: requestId });
}

// Severs both VIEWER roles symmetrically.
// Operations are idempotent deletes — a partial failure leaves stale data
// that is harmless and will be cleaned up on the next removeFriend call.
export async function removeFriend(userId: ObjectId, friendId: ObjectId): Promise<void> {
  const db = await getRegistryDb();
  const userTenantId = `user_${userId.toString()}`;
  const friendTenantId = `user_${friendId.toString()}`;

  await Promise.all([
    db
      .collection('user_tenant_roles')
      .deleteOne({ userId: friendId, tenantId: userTenantId, role: 'VIEWER' }),
    db
      .collection('user_tenant_roles')
      .deleteOne({ userId, tenantId: friendTenantId, role: 'VIEWER' }),
    db.collection('friend_requests').deleteMany({
      $or: [
        { requesterId: userId, recipientId: friendId },
        { requesterId: friendId, recipientId: userId },
      ],
    }),
  ]);
}

export async function getFriends(userId: ObjectId): Promise<UserDocument[]> {
  const db = await getRegistryDb();
  const myTenantId = `user_${userId.toString()}`;

  const viewerRoles = await db
    .collection('user_tenant_roles')
    .find({ tenantId: myTenantId, role: 'VIEWER' })
    .toArray();

  if (viewerRoles.length === 0) return [];

  const friendIds = viewerRoles.map((r) => r.userId);
  return db.collection<UserDocument>('users').find({ _id: { $in: friendIds } }).toArray();
}

export async function getFriendshipStatus(
  currentUserId: ObjectId,
  targetUserId: ObjectId
): Promise<FriendshipStatus> {
  const db = await getRegistryDb();
  const targetTenantId = `user_${targetUserId.toString()}`;

  const isFriend = await db
    .collection('user_tenant_roles')
    .findOne({ userId: currentUserId, tenantId: targetTenantId, role: 'VIEWER' });
  if (isFriend) return 'FRIENDS';

  const sent = await db
    .collection('friend_requests')
    .findOne({ requesterId: currentUserId, recipientId: targetUserId });
  if (sent) return 'PENDING_SENT';

  const received = await db
    .collection('friend_requests')
    .findOne({ requesterId: targetUserId, recipientId: currentUserId });
  if (received) return 'PENDING_RECEIVED';

  return 'NONE';
}
