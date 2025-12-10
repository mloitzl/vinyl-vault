// BFF Resolver Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GraphQLContext } from '../types/context.js';
import { resolvers } from './resolvers.js';

// Mock the backend client
vi.mock('../services/backendClient.js', () => ({
  queryBackend: vi.fn(),
}));

// Mock the JWT signing
vi.mock('../auth/jwt.js', () => ({
  signJwt: vi.fn(() => 'mock-jwt-token'),
}));

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

import { queryBackend } from '../services/backendClient.js';
import { getAvailableTenants } from '../types/session.js';

describe('BFF Resolvers', () => {
  let mockContext: GraphQLContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
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
      session: {} as any,
    };
  });

  describe('Mutation.createRecord', () => {
    it('should create a record when user is authenticated and has proper role', async () => {
      const mockRecord = {
        id: 'record-1',
        purchaseDate: '2025-12-10T00:00:00.000Z',
        price: 29.99,
        condition: 'Mint',
        location: 'Shelf A1',
        notes: 'Test notes',
        createdAt: '2025-12-10T00:00:00.000Z',
        updatedAt: '2025-12-10T00:00:00.000Z',
        release: {
          id: 'release-1',
          barcode: '123456789',
          artist: 'Test Artist',
          title: 'Test Album',
        },
        owner: {
          id: '123',
          githubLogin: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.png',
        },
      };

      vi.mocked(queryBackend).mockResolvedValue({
        createRecord: mockRecord,
      });

      const result = await resolvers.Mutation.createRecord(
        {},
        {
          input: {
            releaseId: 'release-1',
            purchaseDate: '2025-12-10T00:00:00.000Z',
            price: 29.99,
            condition: 'Mint',
            location: 'Shelf A1',
            notes: 'Test notes',
          },
        },
        mockContext
      );

      expect(result.record).toEqual(mockRecord);
      expect(result.errors).toEqual([]);
      expect(queryBackend).toHaveBeenCalledWith(
        expect.stringContaining('mutation CreateRecord'),
        expect.objectContaining({
          input: expect.objectContaining({
            releaseId: 'release-1',
            condition: 'Mint',
          }),
        }),
        expect.objectContaining({ jwt: 'mock-jwt-token' })
      );
    });

    it('should return error when user is not authenticated', async () => {
      const result = await resolvers.Mutation.createRecord(
        {},
        {
          input: {
            releaseId: 'release-1',
          },
        },
        { ...mockContext, user: null }
      );

      expect(result.record).toBeNull();
      expect(result.errors).toContain('Unauthorized: user not authenticated');
      expect(queryBackend).not.toHaveBeenCalled();
    });

    it('should return error when user has VIEWER role', async () => {
      vi.mocked(getAvailableTenants).mockReturnValue([
        {
          tenantId: 'user_123',
          name: 'Test User',
          tenantType: 'USER',
          role: 'VIEWER',
        },
      ]);

      const result = await resolvers.Mutation.createRecord(
        {},
        {
          input: {
            releaseId: 'release-1',
          },
        },
        mockContext
      );

      expect(result.record).toBeNull();
      expect(result.errors).toContain(
        'Unauthorized: MEMBER or ADMIN role required to create records'
      );
      expect(queryBackend).not.toHaveBeenCalled();
    });
  });

  describe('Mutation.updateRecord', () => {
    it('should update a record when user is authenticated and has proper role', async () => {
      const mockRecord = {
        id: 'record-1',
        condition: 'Very Good',
        price: 25.0,
      };

      vi.mocked(queryBackend).mockResolvedValue({
        updateRecord: mockRecord,
      });

      const result = await resolvers.Mutation.updateRecord(
        {},
        {
          input: {
            id: 'record-1',
            condition: 'Very Good',
            price: 25.0,
          },
        },
        mockContext
      );

      expect(result.record).toEqual(mockRecord);
      expect(result.errors).toEqual([]);
    });

    it('should return error when user is not authenticated', async () => {
      const result = await resolvers.Mutation.updateRecord(
        {},
        {
          input: {
            id: 'record-1',
            condition: 'Mint',
          },
        },
        { ...mockContext, user: null }
      );

      expect(result.record).toBeNull();
      expect(result.errors).toContain('Unauthorized: user not authenticated');
    });
  });

  describe('Mutation.deleteRecord', () => {
    it('should delete a record when user is authenticated and has proper role', async () => {
      vi.mocked(queryBackend).mockResolvedValue({
        deleteRecord: true,
      });

      const result = await resolvers.Mutation.deleteRecord({}, { id: 'record-1' }, mockContext);

      expect(result.deletedRecordId).toBe('record-1');
      expect(result.errors).toEqual([]);
    });

    it('should return error when deletion fails', async () => {
      vi.mocked(queryBackend).mockResolvedValue({
        deleteRecord: false,
      });

      const result = await resolvers.Mutation.deleteRecord({}, { id: 'record-1' }, mockContext);

      expect(result.deletedRecordId).toBeNull();
      expect(result.errors).toContain('Failed to delete record');
    });
  });

  describe('Query.records', () => {
    it('should fetch records when user is authenticated', async () => {
      const mockRecordsResponse = {
        edges: [
          {
            cursor: 'cursor-1',
            node: {
              id: 'record-1',
              condition: 'Mint',
              release: {
                id: 'release-1',
                artist: 'Test Artist',
                title: 'Test Album',
              },
            },
          },
        ],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: 'cursor-1',
          endCursor: 'cursor-1',
        },
        totalCount: 1,
      };

      vi.mocked(queryBackend).mockResolvedValue({
        records: mockRecordsResponse,
      });

      const result = await resolvers.Query.records({}, { first: 10 }, mockContext);

      expect(result.edges).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(queryBackend).toHaveBeenCalledWith(
        expect.stringContaining('query Records'),
        expect.objectContaining({ first: 10 }),
        expect.objectContaining({ jwt: 'mock-jwt-token' })
      );
    });

    it('should return empty result when user is not authenticated', async () => {
      const result = await resolvers.Query.records({}, {}, { ...mockContext, user: null });

      expect(result.edges).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(queryBackend).not.toHaveBeenCalled();
    });
  });
});
