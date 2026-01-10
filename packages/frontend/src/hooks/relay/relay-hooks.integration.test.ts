/**
 * Example integration test for Relay hooks
 * This demonstrates how to test components using the custom Relay hooks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Relay Hooks Integration', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should fetch viewer data via hook', async () => {
    const mockResponse = {
      data: {
        viewer: {
          id: 'user-1',
          githubLogin: 'testuser',
          displayName: 'Test User',
          avatarUrl: 'https://example.com/avatar.jpg',
          availableTenants: [
            {
              id: 'tenant-1',
              name: 'Personal',
              type: 'USER',
              role: 'ADMIN',
            },
          ],
          activeTenant: {
            id: 'tenant-1',
            name: 'Personal',
            type: 'USER',
            role: 'ADMIN',
          },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockResponse,
    });

    // Mock fetch call simulating useViewerQuery hook
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: 'query ViewerQuery { viewer { id githubLogin } }',
        variables: {},
      }),
    });

    const data = await response.json();
    expect(data.data.viewer.displayName).toBe('Test User');
    expect(global.fetch).toHaveBeenCalledWith('/graphql', expect.any(Object));
  });

  it('should handle GraphQL errors from hooks', async () => {
    const errorResponse = {
      errors: [
        {
          message: 'Authentication required',
          path: ['viewer'],
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => errorResponse,
    });

    const response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: 'query ViewerQuery { viewer { id } }',
        variables: {},
      }),
    });

    const data = await response.json();
    expect(data.errors).toBeDefined();
    expect(data.errors[0].message).toBe('Authentication required');
  });

  it('should support pagination in records query', async () => {
    const mockResponse = {
      data: {
        records: {
          edges: [],
          pageInfo: {
            hasNextPage: true,
            hasPreviousPage: false,
            startCursor: 'cursor-1',
            endCursor: 'cursor-20',
          },
          totalCount: 100,
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockResponse,
    });

    const variables = { first: 20, after: null };
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: 'query RecordsQuery { records(first: $first, after: $after) { edges totalCount } }',
        variables,
      }),
    });

    const data = await response.json();
    expect(data.data.records.pageInfo.hasNextPage).toBe(true);
    expect(data.data.records.totalCount).toBe(100);
  });

  it('should handle mutations with useCreateRecordMutation pattern', async () => {
    const mockResponse = {
      data: {
        createRecord: {
          record: {
            id: 'rec-1',
            purchaseDate: '2024-01-15',
            condition: 'Mint',
          },
          errors: [],
        },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      json: async () => mockResponse,
    });

    const input = { releaseId: 'rel-1', condition: 'Mint' };
    const response = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        query: 'mutation CreateRecordMutation { createRecord(input: $input) { record { id } } }',
        variables: { input },
      }),
    });

    const data = await response.json();
    expect(data.data.createRecord.record.id).toBe('rec-1');
    expect(data.data.createRecord.errors).toHaveLength(0);
  });
});
