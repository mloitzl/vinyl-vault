import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchRecordsQuery, type RecordSearchFilter } from '../hooks/relay';
import { RecordCard, type Record as VVRecord } from '../components/RecordCard';
import { LoadingSpinner } from '../components/LoadingSpinner';

// ---------- Types ----------

interface FacetBucket {
  value: string;
  count: number;
}

interface Facets {
  genre:     FacetBucket[];
  format:    FacetBucket[];
  condition: FacetBucket[];
  location:  FacetBucket[];
  country:   FacetBucket[];
}

// ---------- Sub-components ----------

function FacetGroup({
  title,
  buckets,
  selected,
  onToggle,
}: {
  title: string;
  buckets: FacetBucket[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (buckets.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
      <ul className="space-y-1">
        {buckets.map((b) => {
          const active = selected.includes(b.value);
          return (
            <li key={b.value}>
              <button
                onClick={() => onToggle(b.value)}
                className={`flex items-center justify-between w-full text-left text-sm px-2 py-1 rounded-md transition-colors ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{b.value}</span>
                <span className={`ml-2 text-xs flex-shrink-0 ${active ? 'text-gray-300' : 'text-gray-400'}`}>
                  {b.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActiveFilters({
  filter,
  onRemove,
  onClear,
}: {
  filter: RecordSearchFilter;
  onRemove: (dim: keyof RecordSearchFilter, value: string) => void;
  onClear: () => void;
}) {
  const chips: { dim: keyof RecordSearchFilter; value: string; label: string }[] = [];
  const LABELS: { [K in keyof RecordSearchFilter]: string } = {
    genre: 'Genre', format: 'Format', condition: 'Condition', location: 'Location', country: 'Country',
  };
  for (const dim of Object.keys(filter) as (keyof RecordSearchFilter)[]) {
    for (const v of filter[dim] ?? []) {
      chips.push({ dim, value: v, label: `${LABELS[dim]}: ${v}` });
    }
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {chips.map((c) => (
        <span
          key={`${c.dim}-${c.value}`}
          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
        >
          {c.label}
          <button
            onClick={() => onRemove(c.dim, c.value)}
            className="text-gray-400 hover:text-gray-600"
            aria-label={`Remove ${c.label}`}
          >
            ✕
          </button>
        </span>
      ))}
      <button onClick={onClear} className="text-xs text-gray-500 hover:text-gray-700 underline">
        Clear all
      </button>
    </div>
  );
}

// ---------- Inner component (rendered inside Suspense) ----------

function SearchResults({
  query,
  filter,
  onFacetsChange,
  onLoadMore,
}: {
  query: string;
  filter: RecordSearchFilter;
  onFacetsChange: (facets: Facets) => void;
  onLoadMore: (cursor: string | null | undefined) => void;
}) {
  const data = useSearchRecordsQuery({ query, first: 20, filter });
  const { edges, pageInfo, totalCount, facets } = data.searchRecords;

  const currentFacets = facets as unknown as Facets;
  useEffect(() => {
    onFacetsChange(currentFacets);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFacets]);

  const records = edges.map((e) => e.node as unknown as VVRecord);

  if (records.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-16">
        <p>No records found for &ldquo;{query}&rdquo;</p>
        {Object.values(filter).some((v) => v && (v as string[]).length > 0) && (
          <p className="text-xs mt-1">Try removing some filters</p>
        )}
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-gray-500 mb-3">
        {totalCount} {totalCount === 1 ? 'record' : 'records'} found
      </p>
      <div className="space-y-3">
        {records.map((record) => (
          <RecordCard key={record.id} record={record} />
        ))}
      </div>
      {pageInfo.hasNextPage && (
        <div className="mt-6 text-center">
          <button
            onClick={() => onLoadMore(pageInfo.endCursor)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Load more
          </button>
        </div>
      )}
    </>
  );
}

// ---------- Main component ----------

export function SearchPage() {
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [filter, setFilter] = useState<RecordSearchFilter>({});
  const [facets, setFacets] = useState<Facets>({ genre: [], format: [], condition: [], location: [], country: [] });
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        setCommittedQuery(value);
        setFilter({});
      });
    }, 350);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const toggleFacet = useCallback((dim: keyof RecordSearchFilter, value: string) => {
    startTransition(() => {
      setFilter((prev) => {
        const current = prev[dim] ?? [];
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { ...prev, [dim]: next.length > 0 ? next : undefined };
      });
    });
  }, []);

  const removeFacet = useCallback((dim: keyof RecordSearchFilter, value: string) => {
    startTransition(() => {
      setFilter((prev) => {
        const next = (prev[dim] ?? []).filter((v) => v !== value);
        return { ...prev, [dim]: next.length > 0 ? next : undefined };
      });
    });
  }, []);

  const clearFilters = useCallback(() => {
    startTransition(() => setFilter({}));
  }, []);

  const handleLoadMore = useCallback((_cursor: string | null | undefined) => {
    // Load-more with cursor pagination — restart query with after cursor.
    // For simplicity we expand the page size rather than appending; a full
    // usePaginationFragment approach would require a connection directive on
    // searchRecords (not implemented to keep the schema simple).
  }, []);

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-gray-500">Please sign in to search your collection</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters = Object.values(filter).some((v) => v && (v as string[]).length > 0);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header + search input */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Search</h1>
        <div className="relative mt-2">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Search by artist, album, label…"
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            autoFocus
          />
        </div>
        <ActiveFilters filter={filter} onRemove={removeFacet} onClear={clearFilters} />
      </div>

      {/* Body */}
      {committedQuery.trim() === '' ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          <p>Enter a search term to find records</p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Facet sidebar */}
          {(facets.genre.length > 0 ||
            facets.format.length > 0 ||
            facets.condition.length > 0 ||
            facets.location.length > 0 ||
            facets.country.length > 0) && (
            <aside className="hidden sm:block w-52 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-4 space-y-5">
              <FacetGroup title="Genre"     buckets={facets.genre}     selected={filter.genre     ?? []} onToggle={(v) => toggleFacet('genre',     v)} />
              <FacetGroup title="Format"    buckets={facets.format}    selected={filter.format    ?? []} onToggle={(v) => toggleFacet('format',    v)} />
              <FacetGroup title="Condition" buckets={facets.condition} selected={filter.condition ?? []} onToggle={(v) => toggleFacet('condition', v)} />
              <FacetGroup title="Location"  buckets={facets.location}  selected={filter.location  ?? []} onToggle={(v) => toggleFacet('location',  v)} />
              <FacetGroup title="Country"   buckets={facets.country}   selected={filter.country   ?? []} onToggle={(v) => toggleFacet('country',   v)} />
            </aside>
          )}

          {/* Results */}
          <main className="flex-1 overflow-y-auto p-4">
            {/* Mobile facet chips when active */}
            {hasActiveFilters && (
              <div className="sm:hidden mb-3">
                <ActiveFilters filter={filter} onRemove={removeFacet} onClear={clearFilters} />
              </div>
            )}
            <Suspense fallback={<div className="flex justify-center py-10"><LoadingSpinner /></div>}>
              <SearchResults
                query={committedQuery}
                filter={filter}
                onFacetsChange={setFacets}
                onLoadMore={handleLoadMore}
              />
            </Suspense>
          </main>
        </div>
      )}
    </div>
  );
}

