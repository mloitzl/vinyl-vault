// Backend client for proxying requests from BFF

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000/graphql';

export interface BackendClientOptions {
  jwt?: string;
}

/**
 * Tenant information returned from backend queries
 */
export interface TenantInfo {
  tenantId: string;
  tenantType: 'USER' | 'ORGANIZATION';
  name: string;
  databaseName: string;
  createdAt: string;
}

/**
 * User tenant mapping with role information
 */
export interface UserTenant extends TenantInfo {
  userId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

/**
 * Result of adding user to tenant
 */
export interface AddUserToTenantResult {
  userId: string;
  tenantId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  createdAt: string;
}

export async function queryBackend<T>(
  query: string,
  variables: Record<string, unknown>,
  options: BackendClientOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (options.jwt) {
    headers['Authorization'] = `Bearer ${options.jwt}`;
  }

  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'Backend error');
  }

  return result.data as T;
}

/**
 * Create an organization tenant on the backend
 */
export async function createOrganizationTenant(
  orgId: string,
  orgName: string,
  githubOrgName: string,
  jwt: string,
): Promise<TenantInfo> {
  const response = await queryBackend<{ createTenant: TenantInfo }>(
    `
    mutation CreateOrganizationTenant($input: CreateTenantInput!) {
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
        githubOrgName: githubOrgName,
      },
    },
    { jwt },
  );

  return response.createTenant;
}

/**
 * Add a user to an organization tenant
 */
export async function addUserToTenant(
  userId: string,
  tenantId: string,
  role: 'ADMIN' | 'MEMBER' | 'VIEWER',
  jwt: string,
): Promise<AddUserToTenantResult> {
  const response = await queryBackend<{ addUserToTenant: AddUserToTenantResult }>(
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
      userId,
      tenantId,
      role,
    },
    { jwt },
  );

  return response.addUserToTenant;
}

/**
 * Get all tenants for a user
 */
export async function getUserTenants(
  userId: string,
  jwt: string,
): Promise<UserTenant[]> {
  const response = await queryBackend<{ userTenants: UserTenant[] }>(
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
    { userId },
    { jwt },
  );

  return response.userTenants;
}
