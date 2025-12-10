import { ObjectId } from 'mongodb';

// Tenant registry record
export interface TenantDocument {
  _id: ObjectId;
  tenantId: string; // user_{userId} or org_{orgId}
  tenantType: 'USER' | 'ORGANIZATION';
  name: string; // display name (user display name or org name)
  githubOrgName?: string; // org login name (for display), stable tenantId uses orgId
  databaseName: string; // e.g., vinylvault_user_123 or vinylvault_org_9876
  createdAt: Date;
  updatedAt: Date;
}
