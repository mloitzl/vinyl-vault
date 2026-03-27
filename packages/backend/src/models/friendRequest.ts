import { ObjectId } from 'mongodb';

// Pending friend request between two users.
// Once accepted, the document is deleted and symmetric VIEWER roles are granted.
export interface FriendRequestDocument {
  _id: ObjectId;
  requesterId: ObjectId;
  recipientId: ObjectId;
  createdAt: Date;
}
