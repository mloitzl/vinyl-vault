// Organization sync service
// Orchestrates syncing GitHub organizations to backend org tenants

import { ObjectId } from 'mongodb';
import { getUserOrganizations, getOrganizationMembers } from './githubOrgs.js';
import { queryBackend } from './backendClient.js';

/**
 * Represents a GitHub organization
 */
export interface GitHubOrganization {
  id: number;
  login: string;
  name?: string;
  avatarUrl?: string;
  description?: string;
}

/**
 * Represents the result of syncing user organizations
 */
export interface OrgSyncResult {
  personalTenantId: string;
  organizationTenants: Array<{
    tenantId: string;
    orgId: string;
    orgName: string;
    role: 'ADMIN' | 'VIEWER';
  }>;
  syncedAt: string;
  errors: string[];
}

/**
 * Backend GraphQL responses
 */
interface CreateTenantResponse {
  data: {
    createTenant: {
      tenantId: string;
      tenantType: string;
      name: string;
      databaseName: string;
      createdAt: string;
    };
  };
}

interface AddUserToTenantResponse {
  data: {
    addUserToTenant: {
      userId: string;
      tenantId: string;
      role: string;
      createdAt: string;
    };
  };
}

interface GetUserTenantsResponse {
  data: {
    userTenants: Array<{
      userId: string;
      tenantId: string;
      role: string;
      tenantType: string;
      name: string;
      databaseName: string;
      createdAt: string;
    }>;
  };
}

/**
 * Sync user's GitHub organizations to backend org tenants
 *
 * @param userId - MongoDB ObjectId of the user
 * @param githubLogin - GitHub username
 * @param accessToken - GitHub OAuth access token
 * @param jwt - JWT token for backend authentication
 * @param personalTenantId - Optional: pre-known personal tenant ID to avoid DB query
 * @returns OrgSyncResult with personal tenant and organization tenants
 */
export async function syncUserOrganizations(
  userId: ObjectId,
  githubLogin: string,
  accessToken: string,
  jwt: string,
  personalTenantId?: string
): Promise<OrgSyncResult> {
  console.log(`[orgSync] Starting sync for user: ${userId} (github: ${githubLogin})`);

  const syncedAt = new Date().toISOString();
  const errors: string[] = [];
  const organizationTenants: OrgSyncResult['organizationTenants'] = [];
  let resolvedPersonalTenantId = personalTenantId || `user_${userId.toString()}`; // Initialize with default or passed value

  try {
    // Step 1: Fetch user's GitHub organizations
    console.log('[orgSync] Fetching GitHub organizations...');
    let githubOrgs: GitHubOrganization[] = [];
    try {
      githubOrgs = await getUserOrganizations(accessToken);
      console.log(`[orgSync] Fetched ${githubOrgs.length} GitHub organizations`);
    } catch (err: any) {
      const msg = `Failed to fetch GitHub organizations: ${err?.message || String(err)}`;
      console.error(`[orgSync] ${msg}`);
      errors.push(msg);
      // Continue without orgs - don't fail the entire sync
    }

    // Step 2: Get existing user tenants from backend (unless personalTenantId was provided)
    console.log('[orgSync] Fetching existing user tenants...');
    let existingTenants: GetUserTenantsResponse['data']['userTenants'] = [];

    // If personalTenantId was passed, we can skip querying - just use it
    if (!personalTenantId) {
      try {
        const result = await queryBackend<GetUserTenantsResponse['data']>(
          `
          query GetUserTenants($userId: ID!) {
            userTenants(userId: $userId) {
              userId
              tenantId
              role
              tenantType
              name
              databaseName
              createdAt
            }
          }
          `,
          { userId: userId.toString() },
          { jwt }
        );
        existingTenants = result.userTenants;
        console.log(`[orgSync] User has ${existingTenants.length} existing tenants`);
      } catch (err: any) {
        const msg = `Failed to fetch existing user tenants: ${err?.message || String(err)}`;
        console.error(`[orgSync] ${msg}`);
        errors.push(msg);
        // Continue - tenants might exist but query failed
      }

      // Find personal tenant from query results
      const personalTenant = existingTenants.find((t) => t.tenantType === 'USER');
      if (!personalTenant) {
        console.warn('[orgSync] No personal tenant found for user');
        errors.push('Personal tenant not found');
      } else {
        resolvedPersonalTenantId = personalTenant.tenantId;
      }
    } else {
      console.log(`[orgSync] Using provided personal tenant ID: ${personalTenantId}`);
      resolvedPersonalTenantId = personalTenantId;
    }

    // Extract existing org tenants for comparison
    const existingOrgTenantMap = new Map<string, string>();
    for (const tenant of existingTenants) {
      if (tenant.tenantType === 'ORGANIZATION') {
        // Extract orgId from tenantId (format: org_{orgId})
        const orgId = tenant.tenantId.substring(4);
        existingOrgTenantMap.set(orgId, tenant.tenantId);
      }
    }

    // Step 3: For each GitHub org, create org tenant if needed and add user
    for (const org of githubOrgs) {
      try {
        const orgId = org.id.toString();
        const orgName = org.name || org.login;

        // Check if org tenant already exists
        let orgTenantId = existingOrgTenantMap.get(orgId);
        if (!orgTenantId) {
          // Create new org tenant
          console.log(`[orgSync] Creating organization tenant for: ${orgName} (${orgId})`);
          try {
            const createResult = await queryBackend<CreateTenantResponse['data']>(
              `
              mutation CreateTenant($input: CreateTenantInput!) {
                createTenant(input: $input) {
                  tenantId
                  tenantType
                  name
                  databaseName
                  createdAt
                }
              }
              `,
              {
                input: {
                  tenantType: 'ORGANIZATION',
                  name: orgName,
                  githubOrgId: orgId,
                  githubOrgName: org.login,
                },
              },
              { jwt }
            );
            orgTenantId = createResult.createTenant.tenantId;
            console.log(`[orgSync] Created organization tenant: ${orgTenantId}`);
          } catch (err: any) {
            const msg = `Failed to create org tenant for ${orgName}: ${
              err?.message || String(err)
            }`;
            console.error(`[orgSync] ${msg}`);
            errors.push(msg);
            continue; // Skip this org
          }
        } else {
          console.log(`[orgSync] Org tenant already exists: ${orgTenantId}`);
        }

        // Determine user's role in org
        let userRole: 'ADMIN' | 'VIEWER' = 'VIEWER';
        try {
          const members = await getOrganizationMembers(org.login, accessToken);
          // Check if user is an owner/admin in this org
          // For simplicity, we'll check if their login is in the members list and assume VIEWER
          // In a real system, you'd fetch more detailed org role info from GitHub API
          const userInOrg = members.some(
            (m) => m.login.toLowerCase() === githubLogin.toLowerCase()
          );
          if (userInOrg) {
            // Fetch org details to check if user is an admin
            // For now, we'll use a heuristic: query /user/orgs to see memberships
            // In a full implementation, use /user/memberships/orgs/{org}
            userRole = 'VIEWER'; // Default to VIEWER unless we can verify admin status
            console.log(`[orgSync] User role in ${orgName}: ${userRole} (from member list)`);
          }
        } catch (err: any) {
          console.warn(
            `[orgSync] Failed to determine user role in ${orgName}: ${err?.message || String(err)}`
          );
          userRole = 'VIEWER'; // Default to VIEWER on error
        }

        // Add user to org tenant
        console.log(`[orgSync] Adding user to org tenant with role: ${userRole}`);
        try {
          await queryBackend<AddUserToTenantResponse['data']>(
            `
            mutation AddUserToTenant($userId: String!, $tenantId: String!, $role: String!) {
              addUserToTenant(userId: $userId, tenantId: $tenantId, role: $role) {
                userId
                tenantId
                role
                createdAt
              }
            }
            `,
            {
              userId: userId.toString(),
              tenantId: orgTenantId,
              role: userRole,
            },
            { jwt }
          );
          console.log(`[orgSync] Added user to org tenant: ${orgTenantId}`);

          organizationTenants.push({
            tenantId: orgTenantId,
            orgId,
            orgName,
            role: userRole,
          });
        } catch (err: any) {
          const msg = `Failed to add user to org tenant ${orgTenantId}: ${
            err?.message || String(err)
          }`;
          console.error(`[orgSync] ${msg}`);
          errors.push(msg);
          // Continue to next org
        }
      } catch (err: any) {
        const msg = `Unexpected error processing org ${org.login}: ${err?.message || String(err)}`;
        console.error(`[orgSync] ${msg}`);
        errors.push(msg);
      }
    }

    console.log(
      `[orgSync] Sync complete: ${organizationTenants.length} org tenants, ${errors.length} errors`
    );
  } catch (err: any) {
    const msg = `Unexpected error during org sync: ${err?.message || String(err)}`;
    console.error(`[orgSync] ${msg}`);
    errors.push(msg);
  }

  return {
    personalTenantId: resolvedPersonalTenantId,
    organizationTenants,
    syncedAt,
    errors,
  };
}
