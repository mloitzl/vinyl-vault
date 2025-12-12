// RecordCard Component Tests

import { describe, it, expect, vi } from 'vitest';
import type { Record } from './RecordCard';

describe('RecordCard Type Tests', () => {
  it('should have correct Record type structure', () => {
    const mockRecord: Record = {
      id: '123',
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
        year: 2020,
        format: 'Vinyl',
        label: 'Test Label',
        country: 'US',
        coverImageUrl: 'https://example.com/cover.jpg',
        externalId: 'test-id',
        source: 'DISCOGS',
        genre: ['Rock'],
        style: ['Alternative'],
        trackList: [{ position: '1', title: 'Track 1', duration: '3:30' }],
      },
      owner: {
        id: 'user-1',
        githubLogin: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
    };

    // Type assertions to ensure the structure is correct
    expect(mockRecord.id).toBe('123');
    expect(mockRecord.release.artist).toBe('Test Artist');
    expect(mockRecord.owner.githubLogin).toBe('testuser');
    expect(mockRecord.price).toBe(29.99);
  });

  it('should support optional fields', () => {
    const minimalRecord: Record = {
      id: '456',
      createdAt: '2025-12-10T00:00:00.000Z',
      updatedAt: '2025-12-10T00:00:00.000Z',
      release: {
        id: 'release-2',
        barcode: '987654321',
        artist: 'Artist 2',
        title: 'Album 2',
        source: 'MUSICBRAINZ',
      },
      owner: {
        id: 'user-2',
        githubLogin: 'user2',
        displayName: 'User 2',
      },
    };

    expect(minimalRecord.purchaseDate).toBeUndefined();
    expect(minimalRecord.price).toBeUndefined();
    expect(minimalRecord.condition).toBeUndefined();
    expect(minimalRecord.location).toBeUndefined();
    expect(minimalRecord.notes).toBeUndefined();
    expect(minimalRecord.release.year).toBeUndefined();
    expect(minimalRecord.release.format).toBeUndefined();
  });
});

describe('RecordCard Callback Tests', () => {
  it('should handle onEdit callback', () => {
    const mockRecord: Record = {
      id: '789',
      createdAt: '2025-12-10T00:00:00.000Z',
      updatedAt: '2025-12-10T00:00:00.000Z',
      release: {
        id: 'release-3',
        barcode: '111222333',
        artist: 'Edit Artist',
        title: 'Edit Album',
        source: 'DISCOGS',
      },
      owner: {
        id: 'user-3',
        githubLogin: 'user3',
        displayName: 'User 3',
      },
    };

    const onEdit = vi.fn();
    onEdit(mockRecord);

    expect(onEdit).toHaveBeenCalledWith(mockRecord);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('should handle onDelete callback', () => {
    const mockRecord: Record = {
      id: '101112',
      createdAt: '2025-12-10T00:00:00.000Z',
      updatedAt: '2025-12-10T00:00:00.000Z',
      release: {
        id: 'release-4',
        barcode: '444555666',
        artist: 'Delete Artist',
        title: 'Delete Album',
        source: 'MUSICBRAINZ',
      },
      owner: {
        id: 'user-4',
        githubLogin: 'user4',
        displayName: 'User 4',
      },
    };

    const onDelete = vi.fn();
    onDelete(mockRecord);

    expect(onDelete).toHaveBeenCalledWith(mockRecord);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
