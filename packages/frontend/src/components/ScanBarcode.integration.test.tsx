import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test/test-utils';

// Mock Relay hooks with React state to emulate in-flight loading
vi.mock('../hooks/relay', () => ({
  useScanBarcodeMutation: () => {
    const [loading, setLoading] = React.useState(false);
    const mutate = async (barcode: string) => {
      setLoading(true);
      const res = await (global.fetch as any)('/graphql', { method: 'POST' });
      const json = await res.json();
      setLoading(false);
      return json.data.scanBarcode;
    };
    return { mutate, isLoading: loading };
  },
  useCreateRecordMutation: () => {
    const [loading, setLoading] = React.useState(false);
    const mutate = async (input: any) => {
      setLoading(true);
      const res = await (global.fetch as any)('/graphql', { method: 'POST' });
      const json = await res.json();
      setLoading(false);
      return json.data.createRecord;
    };
    return { mutate, isLoading: loading };
  },
}));

import { ScanBarcode } from './ScanBarcode';

// Mock the fetch function with a default implementation
global.fetch = vi.fn(async (input: any) => {
  const url = typeof input === 'string' ? input : input?.url;
  if (url && url.startsWith('/auth/me')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ user: null }),
    } as any;
  }
  // Fallback to a benign default; tests will override via mockResolvedValueOnce
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: {} }),
  } as any;
});

describe('ScanBarcode Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // First network call is AuthContext fetching /auth/me
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ user: null }),
    });
  });

  it('renders the barcode input section', () => {
    render(<ScanBarcode />);

    expect(screen.getByPlaceholderText(/enter or scan barcode/i)).toBeInTheDocument();
    expect(screen.getByText(/lookup/i)).toBeInTheDocument();
    expect(screen.getByText(/use camera/i)).toBeInTheDocument();
  });

  it('renders video element for camera feed', () => {
    const { container } = render(<ScanBarcode />);

    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
  });

  it('displays loading state during barcode lookup', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          scanBarcode: {
            albums: [],
            timing: { totalMs: 100 },
            errors: [],
          },
        },
      }),
    });

    render(<ScanBarcode />);

    const input = screen.getByPlaceholderText(/enter or scan barcode/i);
    fireEvent.change(input, { target: { value: '1234567890' } });

    const lookupButton = screen.getByText(/lookup/i);
    fireEvent.click(lookupButton);

    // While loading
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const searchingButton = buttons.find((btn) => btn.textContent?.includes('Searching'));
      expect(searchingButton).toBeDefined();
    });
  });

  it('displays album results after successful lookup', async () => {
    const mockAlbum = {
      id: '1',
      artist: 'Pink Floyd',
      title: 'The Wall',
      barcodes: ['5099902988313'],
      primaryRelease: {
        release: {
          id: 'r1',
          barcode: '5099902988313',
          artist: 'Pink Floyd',
          title: 'The Wall',
          year: 1979,
          country: 'UK',
          format: 'Vinyl',
          label: 'Harvest',
          coverImageUrl: 'http://example.com/cover.jpg',
          source: 'DISCOGS',
        },
        score: 95,
        scoreBreakdown: {
          mediaType: 10,
          countryPreference: 5,
          trackListCompleteness: 20,
          coverArt: 10,
          labelInfo: 5,
          catalogNumber: 0,
          yearInfo: 5,
          sourceBonus: 5,
        },
      },
      alternativeReleases: [],
      trackList: [{ position: '1', title: 'In the Flesh?', duration: '3:17' }],
      genres: ['Rock'],
      styles: ['Progressive Rock'],
      externalIds: { discogs: ['r1'], musicbrainz: [] },
      coverImageUrl: 'http://example.com/cover.jpg',
      otherTitles: [],
      editionNotes: [],
      releaseCount: 1,
      score: 95,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          scanBarcode: {
            albums: [mockAlbum],
            timing: { totalMs: 1000 },
            errors: [],
          },
        },
      }),
    });

    render(<ScanBarcode />);

    const input = screen.getByPlaceholderText(/enter or scan barcode/i);
    fireEvent.change(input, { target: { value: '5099902988313' } });

    const lookupButton = screen.getByText(/lookup/i);
    fireEvent.click(lookupButton);

    // Wait for album to be displayed
    await waitFor(() => {
      expect(screen.getByText('The Wall')).toBeInTheDocument();
      expect(screen.getByText('Pink Floyd')).toBeInTheDocument();
    });
  });

  it('displays error messages when lookup fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          scanBarcode: {
            albums: [],
            errors: ['Invalid barcode format'],
          },
        },
      }),
    });

    render(<ScanBarcode />);

    const input = screen.getByPlaceholderText(/enter or scan barcode/i);
    fireEvent.change(input, { target: { value: 'invalid' } });

    const lookupButton = screen.getByText(/lookup/i);
    fireEvent.click(lookupButton);

    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/invalid barcode format/i)).toBeInTheDocument();
    });
  });

  it('allows selecting an album and shows add button', async () => {
    const mockAlbum = {
      id: '1',
      artist: 'Pink Floyd',
      title: 'The Wall',
      barcodes: ['5099902988313'],
      primaryRelease: {
        release: {
          id: 'r1',
          barcode: '5099902988313',
          artist: 'Pink Floyd',
          title: 'The Wall',
          year: 1979,
          country: 'UK',
          format: 'Vinyl',
          label: 'Harvest',
          coverImageUrl: 'http://example.com/cover.jpg',
          source: 'DISCOGS',
        },
        score: 95,
        scoreBreakdown: null,
      },
      alternativeReleases: [],
      trackList: [],
      genres: ['Rock'],
      styles: [],
      externalIds: { discogs: ['r1'], musicbrainz: [] },
      coverImageUrl: 'http://example.com/cover.jpg',
      otherTitles: [],
      editionNotes: [],
      releaseCount: 1,
      score: 95,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          scanBarcode: {
            albums: [mockAlbum],
            timing: { totalMs: 1000 },
            errors: [],
          },
        },
      }),
    });

    render(<ScanBarcode />);

    const input = screen.getByPlaceholderText(/enter or scan barcode/i);
    fireEvent.change(input, { target: { value: '5099902988313' } });

    const lookupButton = screen.getByText(/lookup/i);
    fireEvent.click(lookupButton);

    // Wait for album to be displayed
    await waitFor(() => {
      expect(screen.getByText('The Wall')).toBeInTheDocument();
    });

    // Click on the album to select it
    const albumCard = screen.getByText('The Wall').closest('div');
    fireEvent.click(albumCard!);

    // Check for "Add to Collection" button
    await waitFor(() => {
      expect(screen.getByText(/add to collection/i)).toBeInTheDocument();
    });
  });

  it('displays timing information after successful lookup', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          scanBarcode: {
            albums: [],
            timing: { totalMs: 500 },
            errors: [],
          },
        },
      }),
    });

    render(<ScanBarcode />);

    const input = screen.getByPlaceholderText(/enter or scan barcode/i);
    fireEvent.change(input, { target: { value: '1234567890' } });

    const lookupButton = screen.getByText(/lookup/i);
    fireEvent.click(lookupButton);

    // Wait for timing info
    await waitFor(() => {
      expect(screen.getByText(/found 0 albums in 500ms/i)).toBeInTheDocument();
    });
  });

  it('calls onRecordAdded callback when record is successfully added', async () => {
    const onRecordAdded = vi.fn();
    const mockAlbum = {
      id: '1',
      artist: 'Pink Floyd',
      title: 'The Wall',
      barcodes: ['5099902988313'],
      primaryRelease: {
        release: {
          id: 'r1',
          barcode: '5099902988313',
          artist: 'Pink Floyd',
          title: 'The Wall',
          year: 1979,
          country: 'UK',
          format: 'Vinyl',
          label: 'Harvest',
          coverImageUrl: 'http://example.com/cover.jpg',
          source: 'DISCOGS',
        },
        score: 95,
      },
      alternativeReleases: [],
      trackList: [],
      genres: ['Rock'],
      styles: [],
      externalIds: { discogs: ['r1'], musicbrainz: [] },
      coverImageUrl: 'http://example.com/cover.jpg',
      otherTitles: [],
      editionNotes: [],
      releaseCount: 1,
      score: 95,
    };

    // First call for scanBarcode query
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          scanBarcode: {
            albums: [mockAlbum],
            timing: { totalMs: 1000 },
            errors: [],
          },
        },
      }),
    });

    // Second call for createRecord mutation
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          createRecord: {
            record: {
              id: 'rec1',
              purchaseDate: null,
              price: null,
              condition: null,
              location: null,
              notes: null,
              createdAt: '2024-01-01',
              release: {
                id: 'r1',
                artist: 'Pink Floyd',
                title: 'The Wall',
                coverImageUrl: 'http://example.com/cover.jpg',
              },
            },
            errors: [],
          },
        },
      }),
    });

    render(<ScanBarcode onRecordAdded={onRecordAdded} />);

    const input = screen.getByPlaceholderText(/enter or scan barcode/i);
    fireEvent.change(input, { target: { value: '5099902988313' } });

    const lookupButton = screen.getByText(/lookup/i);
    fireEvent.click(lookupButton);

    // Wait for album to appear
    await waitFor(() => {
      expect(screen.getByText('The Wall')).toBeInTheDocument();
    });

    // Click to select album
    const albumCard = screen.getByText('The Wall').closest('div');
    fireEvent.click(albumCard!);

    // Wait for add button to appear
    await waitFor(() => {
      expect(screen.getByText(/add to collection/i)).toBeInTheDocument();
    });

    // Click add button
    const addButton = screen.getByText(/add to collection/i);
    fireEvent.click(addButton);

    // Wait for callback to be called
    await waitFor(() => {
      expect(onRecordAdded).toHaveBeenCalled();
    });
  });
});
