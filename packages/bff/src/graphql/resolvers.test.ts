// BFF Resolver Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GraphQLContext } from '../types/context.js';
import { resolvers } from './resolvers.js';

// Mock session helpers
vi.mock('../types/session.js', () => ({
  getAvailableTenants: vi.fn(() => [
    {
      tenantId: 'user_123',
      name: 'Test User',
      tenantType: 'USER',
      role: 'ADMIN',
    },
  ]),
  setActiveTenant: vi.fn(),
}));

// Mock feature flags
vi.mock('../utils/featureFlags.js', () => ({
  getFeatureFlags: vi.fn(() => ({ enableTenantFeatures: false })),
}));

import { getAvailableTenants, setActiveTenant } from '../types/session.js';
import { getFeatureFlags } from '../utils/featureFlags.js';

describe('BFF Resolvers', () => {
  let mockContext: GraphQLContext;

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(getAvailableTenants).mockReturnValue([
      {
        tenantId: 'user_123',
        name: 'Test User',
        tenantType: 'USER',
        role: 'ADMIN',
      },
    ]);

    vi.mocked(getFeatureFlags).mockReturnValue({ enableTenantFeatures: false });

    mockContext = {
      req: {} as any,
      res: {} as any,
      user: {
        id: '123',
        githubId: '456',
        githubLogin: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      activeTenantId: 'user_123',
      session: { activeTenantId: 'user_123', save: (cb: (err: any) => void) => cb(null) } as any,
    };
  });

  describe('Query.viewer', () => {
    it('should return user when authenticated', async () => {
      const result = await resolvers.Query.viewer({}, {}, mockContext);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('123');
      expect(result?.githubLogin).toBe('testuser');
    });

    it('should return null when unauthenticated', async () => {
      const result = await resolvers.Query.viewer({}, {}, { ...mockContext, user: null });
      expect(result).toBeNull();
    });
  });

  describe('Mutation.switchTenant', () => {
    it('should switch tenant and save session', async () => {
      const result = await resolvers.Mutation.switchTenant({}, { tenantId: 'user_123' }, mockContext);
      expect(setActiveTenant).toHaveBeenCalledWith(mockContext.session, 'user_123');
      expect(result.id).toBe('123');
    });

    it('should throw when user does not have access to tenant', async () => {
      await expect(
        resolvers.Mutation.switchTenant({}, { tenantId: 'other_tenant' }, mockContext)
      ).rejects.toThrow('Unauthorized');
    });

    it('should throw when unauthenticated', async () => {
      await expect(
        resolvers.Mutation.switchTenant({}, { tenantId: 'user_123' }, { ...mockContext, user: null })
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('User.availableTenants', () => {
    it('should return tenants mapped from session', () => {
      const result = resolvers.User.availableTenants({}, {}, mockContext);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user_123');
      expect(result[0].role).toBe('ADMIN');
    });

    it('should return empty array when no tenants in session', () => {
      vi.mocked(getAvailableTenants).mockReturnValue([]);
      const result = resolvers.User.availableTenants({}, {}, mockContext);
      expect(result).toEqual([]);
    });
  });

  describe('User.activeTenant', () => {
    it('should return the active tenant from session', () => {
      const result = resolvers.User.activeTenant({}, {}, mockContext);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('user_123');
    });

    it('should return null when activeTenantId does not match any tenant', () => {
      const result = resolvers.User.activeTenant({}, {}, {
        ...mockContext,
        activeTenantId: 'unknown_tenant',
        session: { activeTenantId: 'unknown_tenant' } as any,
      });
      expect(result).toBeNull();
    });
  });

  describe('User.featureFlags', () => {
    it('should return feature flags', () => {
      const result = resolvers.User.featureFlags();
      expect(result).toEqual({ enableTenantFeatures: false });
    });
  });
});


// Mock the backend client
vi.mock('../services/backendClient.js', () => ({
  queryBackend: vi.fn(),
}));

// Mock the JWT signing
vi.mock('../auth/jwt.js', () => ({
  signJwt: vi.fn(() => 'mock-jwt-token'),
}));














