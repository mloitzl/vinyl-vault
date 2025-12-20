// Tenant service
// Manages tenant lifecycle: creation, user role management, and tenant queries

import { ObjectId } from 'mongodb';
import { getRegistryDb } from '../db/registry.js';
import { logger } from '../utils/logger.js';
import { getTenantDbName } from '../db/connection.js';
import type { TenantDocument } from '../models/tenant.js';
import type { UserTenantRoleDocument } from '../models/userTenantRole.js';

export type TenantType = 'USER' | 'ORGANIZATION';
export type TenantRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

// Create a personal USER tenant for a user
// tenantId = user_{userId}
// databaseName = vinylvault_user_{userId}
export async function createPersonalTenant(
  userId: ObjectId,
  username: string
): Promise<TenantDocument> {
  const registryDb = await getRegistryDb();
  const tenantId = `user_${userId.toString()}`;
  const databaseName = getTenantDbName(tenantId);

  const now = new Date();
  const tenant: TenantDocument = {
    _id: new ObjectId(),
    tenantId,
    tenantType: 'USER',
    name: username,
    databaseName,
    createdAt: now,
    updatedAt: now,
  };

  const result = await registryDb.collection('tenants').insertOne(tenant);
  logger.info({ tenantId, insertedId: result.insertedId }, 'Created personal tenant');

  return tenant;
}

// Create an ORGANIZATION tenant
// tenantId = org_{orgId}
// databaseName = vinylvault_org_{orgId}
export async function createOrganizationTenant(
  orgId: string,
  orgName: string,
  githubOrgName?: string
): Promise<TenantDocument> {
  const registryDb = await getRegistryDb();
  const tenantId = `org_${orgId}`;
  const databaseName = getTenantDbName(tenantId);

  const now = new Date();
  const tenant: TenantDocument = {
    _id: new ObjectId(),
    tenantId,
    tenantType: 'ORGANIZATION',
    name: orgName,
    githubOrgName,
    databaseName,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await registryDb.collection('tenants').insertOne(tenant);
    logger.info({ tenantId, insertedId: result.insertedId }, 'Created organization tenant');
    return tenant;
  } catch (err: any) {
    if (err.code === 11000) {
      // Tenant already exists, return the existing one
      const existing = await registryDb.collection('tenants').findOne({ tenantId });
      if (existing) {
        logger.info({ tenantId }, 'Organization tenant already exists');
        return existing as TenantDocument;
      }
    }
    throw err;
  }
}

// Get all tenants for a user (including role information)
export async function getUserTenants(
  userId: ObjectId
): Promise<(TenantDocument & { role: TenantRole; userId: ObjectId })[]> {
  const registryDb = await getRegistryDb();

  const userTenants = await registryDb
    .collection('user_tenant_roles')
    .aggregate<TenantDocument & { role: TenantRole; userId: ObjectId }>([
      {
        $match: { userId },
      },
      {
        $lookup: {
          from: 'tenants',
          localField: 'tenantId',
          foreignField: 'tenantId',
          as: 'tenant',
        },
      },
      { $unwind: '$tenant' },
      {
        $addFields: {
          _id: '$tenant._id',
          tenantId: '$tenant.tenantId',
          tenantType: '$tenant.tenantType',
          name: '$tenant.name',
          githubOrgName: '$tenant.githubOrgName',
          databaseName: '$tenant.databaseName',
          createdAt: '$tenant.createdAt',
          updatedAt: '$tenant.updatedAt',
          role: '$role',
          userId: '$userId',
        },
      },
      {
        $project: {
          tenant: 0,
        },
      },
    ])
    .toArray();

  return userTenants;
}

// Add a user to a tenant with a specific role
// If this is the first user in an ORGANIZATION tenant, automatically assign ADMIN role
// Throws if user already has a role in this tenant
export async function addUserToTenant(
  userId: ObjectId,
  tenantId: string,
  role: TenantRole
): Promise<UserTenantRoleDocument> {
  const registryDb = await getRegistryDb();

  // For organization tenants, check if this is the first user
  let effectiveRole = role;
  if (tenantId.startsWith('org_') && role === 'VIEWER') {
    const existingUsers = await registryDb
      .collection('user_tenant_roles')
      .countDocuments({ tenantId });

    if (existingUsers === 0) {
      // First user in org gets ADMIN role
      effectiveRole = 'ADMIN';
      logger.info(
        { userId: userId.toString(), tenantId },
        'First user in org tenant, assigning ADMIN role'
      );
    }
  }

  const now = new Date();
  const userTenantRole: UserTenantRoleDocument = {
    _id: new ObjectId(),
    userId,
    tenantId,
    role: effectiveRole,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await registryDb.collection('user_tenant_roles').insertOne(userTenantRole);
    logger.info(
      { userId: userId.toString(), tenantId, role: effectiveRole, insertedId: result.insertedId },
      'Added user to tenant'
    );
    return userTenantRole;
  } catch (err: any) {
    if (err.code === 11000) {
      // Duplicate key error — user already has a role in this tenant
      throw new Error(`User already has a role in tenant ${tenantId}`);
    }
    throw err;
  }
}

// Remove a user from a tenant
export async function removeUserFromTenant(userId: ObjectId, tenantId: string): Promise<boolean> {
  const registryDb = await getRegistryDb();

  const result = await registryDb.collection('user_tenant_roles').deleteOne({ userId, tenantId });

  const removed = result.deletedCount > 0;
  if (removed) {
    logger.info({ userId: userId.toString(), tenantId }, 'Removed user from tenant');
  }

  return removed;
}

// Update a user's role in a tenant
export async function updateUserTenantRole(
  userId: ObjectId,
  tenantId: string,
  newRole: TenantRole
): Promise<UserTenantRoleDocument | null> {
  const registryDb = await getRegistryDb();

  const now = new Date();
  const updateResult = await registryDb.collection('user_tenant_roles').findOneAndUpdate(
    { userId, tenantId },
    {
      $set: {
        role: newRole,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  );

  const value = updateResult?.value as UserTenantRoleDocument | null;
  if (value) {
    logger.info({ userId: userId.toString(), tenantId, newRole }, 'Updated user role in tenant');
  }

  return value;
}

// Get a tenant by tenantId
export async function getTenantById(tenantId: string): Promise<TenantDocument | null> {
  const registryDb = await getRegistryDb();

  return (await registryDb.collection('tenants').findOne({ tenantId })) as TenantDocument | null;
}

// Get a user's role in a specific tenant
export async function getUserTenantRole(userId: ObjectId, tenantId: string): Promise<TenantRole | null> {
  const registryDb = await getRegistryDb();

  const userTenantRole = (await registryDb
    .collection('user_tenant_roles')
    .findOne({ userId, tenantId })) as UserTenantRoleDocument | null;

  return userTenantRole?.role || null;
}
