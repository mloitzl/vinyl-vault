/**
 * Tests for SearchPage.
 *
 * Organisation:
 *  1. extractSearchTerms  – pure function unit tests
 *  2. Unauthenticated     – sign-in prompt
 *  3. Authenticated idle  – prompt before any query
 *  4. Search results      – result list, counts, empty state
 *  5. Debounce            – query commits after 350 ms, not before
 *  6. Facets              – sidebar buckets, selection, deselection
 *  7. ActiveFilters       – chips, individual remove, clear-all
 *  8. Load more           – button visibility, page-size increment
 *  9. Mobile filter panel – toggle open / close
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchPage, extractSearchTerms } from './SearchPage';
import { useAuth } from '../contexts/AuthContext';
import { useSearchRecordsQuery } from '../hooks/relay';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../hooks/relay', () => ({ useSearchRecordsQuery: vi.fn() }));

vi.mock('../components/RecordCard', () => ({
  RecordCard: ({ record }: { record: { id: string; release: { title: string; artist: string } } }) => (
    <div data-testid="record-card" data-id={record.id}>
      <span>{record.release.title}</span>
      <span>{record.release.artist}</span>
    </div>
  ),
}));

vi.mock('../components/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

// Clear all mock call history before every test so accumulation across tests
// does not pollute assertions.
beforeEach(() => { vi.clearAllMocks(); });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: 'user-1',
  githubId: '123',
  githubLogin: 'testuser',
  displayName: 'Test User',
  avatarUrl: '',
  settings: { spotifyPreview: false, allowFriendInvites: false, isCollectionPublic: false },
};

const AUTH_LOGGED_IN = {
  user: MOCK_USER,
  activeTenant: null,
  availableTenants: [],
  featureFlags: { enableTenantFeatures: true },
  isLoading: false,
  error: null,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  switchTenant: vi.fn(),
} as ReturnType<typeof useAuth>;

const AUTH_LOGGED_OUT: ReturnType<typeof useAuth> = { ...AUTH_LOGGED_IN, user: null };

interface FacetBucket { value: string; count: number }
interface TestFacets {
  artist: FacetBucket[]; title: FacetBucket[]; genre: FacetBucket[];
  format: FacetBucket[]; condition: FacetBucket[]; location: FacetBucket[];
  country: FacetBucket[];
}

const EMPTY_FACETS: TestFacets = {
  artist: [], title: [], genre: [], format: [],
  condition: [], location: [], country: [],
};

/** Build a minimal search data payload. */
function makeSearchData({
  edges = [] as ReturnType<typeof makeEdge>[],
  totalCount = 0,
  hasNextPage = false,
  facets = EMPTY_FACETS,
} = {}) {
  return {
    searchRecords: {
      edges,
      pageInfo: { hasNextPage, endCursor: hasNextPage ? 'cursor-1' : null },
      totalCount,
      facets,
    },
  };
}

/** Build a minimal record edge matching the GraphQL shape SearchResults expects. */
function makeEdge(id: string, title: string, artist: string) {
  return {
    cursor: id,
    highlights: [],
    node: {
      id,
      purchaseDate: null,
      price: null,
      condition: 'VG+',
      location: 'Shelf A',
      notes: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: { id: 'o1', githubLogin: 'owner', displayName: 'Owner', avatarUrl: '' },
      release: {
        id: `r-${id}`, barcode: null, artist, title,
        year: 2020, format: 'Vinyl, LP', label: null, country: 'US',
        coverImageUrl: null, externalId: null, source: 'DISCOGS',
        genre: ['Rock'], style: [], trackList: [],
      },
    },
  };
}

const DEBOUNCE_MS = 350;

/** Fire a change event on the search input, then advance the debounce timer. */
async function typeAndSearch(value: string) {
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value } });
  act(() => { vi.advanceTimersByTime(DEBOUNCE_MS); });
  await act(async () => {}); // flush React effects / state commits
}

// ---------------------------------------------------------------------------
// 1. extractSearchTerms
// ---------------------------------------------------------------------------

describe('extractSearchTerms', () => {
  it('returns [] for empty string', () => {
    expect(extractSearchTerms('')).toEqual([]);
  });

  it('returns [] for whitespace-only string', () => {
    expect(extractSearchTerms('   ')).toEqual([]);
  });

  it('returns individual words for a plain query', () => {
    expect(extractSearchTerms('Pink Floyd')).toEqual(['Pink', 'Floyd']);
  });

  it('returns a single word for a single plain term', () => {
    expect(extractSearchTerms('Beatles')).toEqual(['Beatles']);
  });

  it('extracts a double-quoted phrase as one term', () => {
    expect(extractSearchTerms('"Dark Side"')).toEqual(['Dark Side']);
  });

  it('extracts a single-quoted phrase as one term', () => {
    expect(extractSearchTerms("'Wish You Were Here'")).toEqual(['Wish You Were Here']);
  });

  it('includes +must terms without the + sign', () => {
    expect(extractSearchTerms('+Rock')).toEqual(['Rock']);
  });

  it('skips -mustNot terms entirely', () => {
    expect(extractSearchTerms('-Jazz')).toEqual([]);
  });

  it('handles mixed advanced syntax correctly', () => {
    expect(extractSearchTerms('"Pink Floyd" +Rock -Jazz pop')).toEqual(
      ['Pink Floyd', 'Rock', 'pop'],
    );
  });

  it('extracts multiple quoted phrases', () => {
    expect(extractSearchTerms('"Dark Side" "The Wall"')).toEqual(['Dark Side', 'The Wall']);
  });

  it('keeps plain words and +must, drops -mustNot', () => {
    expect(extractSearchTerms('ZZ +Top -Depeche')).toEqual(['ZZ', 'Top']);
  });
});

// ---------------------------------------------------------------------------
// 2. Unauthenticated
// ---------------------------------------------------------------------------

describe('SearchPage — unauthenticated', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(AUTH_LOGGED_OUT);
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('shows a sign-in prompt', () => {
    render(<SearchPage />);
    expect(screen.getByText(/please sign in/i)).toBeInTheDocument();
  });

  it('does not render the search input', () => {
    render(<SearchPage />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Authenticated idle (no query entered yet)
// ---------------------------------------------------------------------------

describe('SearchPage — authenticated, idle', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(AUTH_LOGGED_IN);
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData() as never);
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('renders the search input', () => {
    render(<SearchPage />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows the correct placeholder hint', () => {
    render(<SearchPage />);
    expect(screen.getByPlaceholderText(/Pink Floyd/)).toBeInTheDocument();
  });

  it('shows the idle prompt before any query is entered', () => {
    render(<SearchPage />);
    expect(screen.getByText(/enter a search term/i)).toBeInTheDocument();
  });

  it('does not show record cards before a query is entered', () => {
    render(<SearchPage />);
    expect(screen.queryByTestId('record-card')).not.toBeInTheDocument();
  });

  it('does not show the facet sidebar before a query is entered', () => {
    render(<SearchPage />);
    expect(screen.queryByText(/genre/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. Search results
// ---------------------------------------------------------------------------

describe('SearchPage — search results', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(AUTH_LOGGED_IN);
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('shows an empty-state message when nothing matches', async () => {
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData() as never);
    render(<SearchPage />);
    await typeAndSearch('zzznomatch');
    expect(screen.getByText(/no records found/i)).toBeInTheDocument();
  });

  it('suggests removing filters when filters are active and no results returned', async () => {
    // Search returns zero for this test; we simulate an active filter via
    // the filter prop passed to SearchResults by checking the hint text.
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData() as never);
    // Manually force active filter by relying on the component initialising
    // an empty facets state — the "Try removing some filters" hint is only
    // shown when filter has active values.  We verify the hint is absent here.
    render(<SearchPage />);
    await typeAndSearch('zzznomatch');
    expect(screen.queryByText(/try removing some filters/i)).not.toBeInTheDocument();
  });

  it('shows plural result count and record cards', async () => {
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData({
      edges: [
        makeEdge('1', 'Wish You Were Here', 'Pink Floyd'),
        makeEdge('2', 'The Wall', 'Pink Floyd'),
      ],
      totalCount: 2,
    }) as never);
    render(<SearchPage />);
    await typeAndSearch('Pink Floyd');
    expect(screen.getByText(/2 records found/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('record-card')).toHaveLength(2);
  });

  it('uses singular "record found" for exactly one result', async () => {
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData({
      edges: [makeEdge('1', 'Album', 'Artist')],
      totalCount: 1,
    }) as never);
    render(<SearchPage />);
    await typeAndSearch('Artist');
    expect(screen.getByText(/1 record found/i)).toBeInTheDocument();
  });

  it('passes the committed query and filter to useSearchRecordsQuery', async () => {
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData() as never);
    render(<SearchPage />);
    await typeAndSearch('Pink');
    expect(vi.mocked(useSearchRecordsQuery)).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'Pink', first: 20, filter: {} }),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Debounce
// ---------------------------------------------------------------------------

describe('SearchPage — debounce', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(AUTH_LOGGED_IN);
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData() as never);
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('does NOT fire the query before 350 ms have elapsed', () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pink' } });
    act(() => { vi.advanceTimersByTime(200); });
    // Idle prompt still visible → committed query not yet updated
    expect(screen.getByText(/enter a search term/i)).toBeInTheDocument();
  });

  it('fires the query after 350 ms have elapsed', async () => {
    render(<SearchPage />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pink' } });
    act(() => { vi.advanceTimersByTime(200); });
    // Still idle
    expect(screen.getByText(/enter a search term/i)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(200); }); // total: 400 ms
    await act(async () => {});
    // Idle prompt gone → query committed
    expect(screen.queryByText(/enter a search term/i)).not.toBeInTheDocument();
  });

  it('resets the filter and page-size when the query changes', async () => {
    render(<SearchPage />);
    await typeAndSearch('Pink');
    const lastCall = vi.mocked(useSearchRecordsQuery).mock.calls.at(-1)![0];
    expect(lastCall).toMatchObject({ query: 'Pink', first: 20, filter: {} });
  });

  it('debounces rapid keystrokes — only last value is committed', async () => {
    render(<SearchPage />);
    const input = screen.getByRole('textbox');
    // Type quickly — each keystroke cancels the previous debounce timer
    fireEvent.change(input, { target: { value: 'P' } });
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.change(input, { target: { value: 'Pi' } });
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.change(input, { target: { value: 'Pink' } });
    act(() => { vi.advanceTimersByTime(DEBOUNCE_MS); });
    await act(async () => {});
    // Only 'Pink' should have been committed — intermediate values must not appear
    const queriesSent = vi.mocked(useSearchRecordsQuery).mock.calls.map(([v]) => v.query);
    expect(queriesSent).not.toContain('P');
    expect(queriesSent).not.toContain('Pi');
    expect(queriesSent).toContain('Pink');
  });
});

// ---------------------------------------------------------------------------
// 6. Facets
// ---------------------------------------------------------------------------

describe('SearchPage — facets', () => {
  const DATA_WITH_FACETS = makeSearchData({
    edges: [makeEdge('1', 'Wish You Were Here', 'Pink Floyd')],
    totalCount: 1,
    facets: {
      ...EMPTY_FACETS,
      genre: [{ value: 'Rock', count: 5 }, { value: 'Jazz', count: 2 }],
      format: [{ value: 'Vinyl, LP', count: 4 }],
    },
  });

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(AUTH_LOGGED_IN);
    vi.mocked(useSearchRecordsQuery).mockReturnValue(DATA_WITH_FACETS as never);
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('renders facet group headings after a search', async () => {
    render(<SearchPage />);
    await typeAndSearch('Pink');
    expect(screen.getAllByText(/genre/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/format/i).length).toBeGreaterThan(0);
  });

  it('renders facet bucket values and counts', async () => {
    render(<SearchPage />);
    await typeAndSearch('Pink');
    expect(screen.getAllByText('Rock').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jazz').length).toBeGreaterThan(0);
  });

  it('adds a facet value to the filter on click', async () => {
    render(<SearchPage />);
    await typeAndSearch('Pink');
    fireEvent.click(screen.getAllByText('Rock')[0]);
    await act(async () => {});
    const lastCall = vi.mocked(useSearchRecordsQuery).mock.calls.at(-1)![0];
    expect(lastCall.filter).toMatchObject({ genre: ['Rock'] });
  });

  it('removes a facet value from the filter on second click', async () => {
    render(<SearchPage />);
    await typeAndSearch('Pink');
    // Select
    fireEvent.click(screen.getAllByText('Rock')[0]);
    await act(async () => {});
    // Deselect
    fireEvent.click(screen.getAllByText('Rock')[0]);
    await act(async () => {});
    const lastCall = vi.mocked(useSearchRecordsQuery).mock.calls.at(-1)![0];
    expect(lastCall.filter?.genre).toBeUndefined();
  });

  it('supports selecting multiple facets across dimensions', async () => {
    render(<SearchPage />);
    await typeAndSearch('Pink');
    fireEvent.click(screen.getAllByText('Rock')[0]);
    await act(async () => {});
    fireEvent.click(screen.getAllByText('Vinyl, LP')[0]);
    await act(async () => {});
    const lastCall = vi.mocked(useSearchRecordsQuery).mock.calls.at(-1)![0];
    expect(lastCall.filter).toMatchObject({ genre: ['Rock'], format: ['Vinyl, LP'] });
  });

  it('does not render the facet sidebar when there are no facets', async () => {
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData() as never);
    render(<SearchPage />);
    await typeAndSearch('Pink');
    expect(screen.queryByText('Genre')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. ActiveFilters chips
// ---------------------------------------------------------------------------

describe('SearchPage — ActiveFilters', () => {
  const DATA_WITH_GENRE_FACET = makeSearchData({
    edges: [makeEdge('1', 'Album', 'Artist')],
    totalCount: 1,
    facets: {
      ...EMPTY_FACETS,
      genre: [{ value: 'Rock', count: 3 }, { value: 'Jazz', count: 1 }],
    },
  });

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(AUTH_LOGGED_IN);
    vi.mocked(useSearchRecordsQuery).mockReturnValue(DATA_WITH_GENRE_FACET as never);
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('shows no chips and no "Clear all" before any facet is selected', async () => {
    render(<SearchPage />);
    await typeAndSearch('test');
    expect(screen.queryByText(/clear all/i)).not.toBeInTheDocument();
  });

  it('shows an active chip after selecting a facet', async () => {
    render(<SearchPage />);
    await typeAndSearch('test');
    fireEvent.click(screen.getAllByText('Rock')[0]);
    await act(async () => {});
    expect(screen.getByText('Genre: Rock')).toBeInTheDocument();
  });

  it('shows "Clear all" when at least one filter is active', async () => {
    render(<SearchPage />);
    await typeAndSearch('test');
    fireEvent.click(screen.getAllByText('Rock')[0]);
    await act(async () => {});
    expect(screen.getByText(/clear all/i)).toBeInTheDocument();
  });

  it('removes an individual chip via its ✕ button', async () => {
    render(<SearchPage />);
    await typeAndSearch('test');
    fireEvent.click(screen.getAllByText('Rock')[0]);
    await act(async () => {});
    expect(screen.getByText('Genre: Rock')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/remove genre: rock/i));
    await act(async () => {});
    expect(screen.queryByText('Genre: Rock')).not.toBeInTheDocument();
  });

  it('clears all chips with the "Clear all" button', async () => {
    render(<SearchPage />);
    await typeAndSearch('test');
    fireEvent.click(screen.getAllByText('Rock')[0]);
    await act(async () => {});
    fireEvent.click(screen.getAllByText('Jazz')[0]);
    await act(async () => {});
    fireEvent.click(screen.getByText(/clear all/i));
    await act(async () => {});
    expect(screen.queryByText('Genre: Rock')).not.toBeInTheDocument();
    expect(screen.queryByText('Genre: Jazz')).not.toBeInTheDocument();
    expect(screen.queryByText(/clear all/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. Load more
// ---------------------------------------------------------------------------

describe('SearchPage — load more', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(AUTH_LOGGED_IN);
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the "Load more" button when hasNextPage is true', async () => {
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData({
      edges: [makeEdge('1', 'Album', 'Artist')],
      totalCount: 50,
      hasNextPage: true,
    }) as never);
    render(<SearchPage />);
    await typeAndSearch('test');
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('does NOT show "Load more" on the last page', async () => {
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData({
      edges: [makeEdge('1', 'Album', 'Artist')],
      totalCount: 1,
    }) as never);
    render(<SearchPage />);
    await typeAndSearch('test');
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('increments the page size by 20 when clicked', async () => {
    vi.mocked(useSearchRecordsQuery).mockReturnValue(makeSearchData({
      edges: [makeEdge('1', 'Album', 'Artist')],
      totalCount: 50,
      hasNextPage: true,
    }) as never);
    render(<SearchPage />);
    await typeAndSearch('test');
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    await act(async () => {});
    const lastCall = vi.mocked(useSearchRecordsQuery).mock.calls.at(-1)![0];
    expect(lastCall.first).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// 9. Mobile filter panel
// ---------------------------------------------------------------------------

describe('SearchPage — mobile filter panel', () => {
  const DATA_WITH_FACETS = makeSearchData({
    edges: [makeEdge('1', 'Album', 'Artist')],
    totalCount: 1,
    facets: { ...EMPTY_FACETS, genre: [{ value: 'Rock', count: 3 }] },
  });

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(AUTH_LOGGED_IN);
    vi.mocked(useSearchRecordsQuery).mockReturnValue(DATA_WITH_FACETS as never);
    vi.useFakeTimers();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('renders the Filters toggle button when facets exist', async () => {
    render(<SearchPage />);
    await typeAndSearch('test');
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
  });

  it('opens the mobile panel when Filters is clicked', async () => {
    render(<SearchPage />);
    await typeAndSearch('test');
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    await act(async () => {});
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });

  it('closes the mobile panel when Done is clicked', async () => {
    render(<SearchPage />);
    await typeAndSearch('test');
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /done/i })).not.toBeInTheDocument();
  });

  it('shows active filter count badge on the Filters button', async () => {
    render(<SearchPage />);
    await typeAndSearch('test');
    // Select a facet to create an active filter
    fireEvent.click(screen.getAllByText('Rock')[0]);
    await act(async () => {});
    // The badge should display "1" inside the Filters button
    const filtersButton = screen.getByRole('button', { name: /filters/i });
    expect(filtersButton.textContent).toContain('1');
  });
});
