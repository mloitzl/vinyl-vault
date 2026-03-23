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

  await db.collection<Omit<FriendRequestDocument, '_id'>>('friend_requests').insertOne({
    requesterId,
    recipientId,
    createdAt: new Date(),
  } as FriendRequestDocument);
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

// accept=true: delete request + grant symmetric VIEWER roles.
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

  await db.collection('friend_requests').deleteOne({ _id: requestId });

  if (accept) {
    const requesterTenantId = `user_${request.requesterId.toString()}`;
    const recipientTenantId = `user_${request.recipientId.toString()}`;

    await Promise.all([
      ensureUserInTenant(request.requesterId, recipientTenantId, 'VIEWER'),
      ensureUserInTenant(request.recipientId, requesterTenantId, 'VIEWER'),
    ]);
  }
}

// Severs both VIEWER roles symmetrically.
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
