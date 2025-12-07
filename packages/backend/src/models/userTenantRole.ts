import { ObjectId } from 'mongodb';

// Mapping of users to tenants with roles
export interface UserTenantRoleDocument {
  _id: ObjectId;
  userId: ObjectId; // reference to users collection in registry
  tenantId: string; // tenant identifier (user_{userId} or org_{orgId})
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: Date;
  updatedAt: Date;
}
