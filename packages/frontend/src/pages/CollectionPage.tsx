import { useState, useEffect, useCallback } from 'react';
import { RecordCard, type Record } from '../components/RecordCard';
import { ErrorAlert } from '../components/ErrorAlert';
import { RecordEditModal, type RecordUpdates } from '../components/RecordEditModal';
import { Toast } from '../components/Toast';

type PageInfo = {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
};

type RecordEdge = {
  cursor: string;
  node: Record;
};

type RecordsResponse = {
  edges: RecordEdge[];
  pageInfo: PageInfo;
  totalCount: number;
};

type RecordFilter = {
  artist?: string;
  title?: string;
  year?: number;
  format?: string;
  location?: string;
  search?: string;
};

type FetchRecordsVariables = {
  first: number;
  after?: string;
  filter?: RecordFilter;
};

interface CollectionPageProps {
  onNavigateToScan?: () => void;
}

export function CollectionPage({ onNavigateToScan }: CollectionPageProps) {
  const [records, setRecords] = useState<Record[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>({
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecords = useCallback(
    async (after?: string) => {
      setIsLoading(true);
      setErrors([]);

      const query = `query FetchRecords($first: Int, $after: String, $filter: RecordFilter) {
      records(first: $first, after: $after, filter: $filter) {
        edges {
          cursor
          node {
            id
            purchaseDate
            price
            condition
            location
            notes
            createdAt
            updatedAt
            release {
              id
              barcode
              artist
              title
              year
              format
              genre
              style
              label
              country
              coverImageUrl
              externalId
              source
              trackList { position title duration }
            }
            owner {
              id
              githubLogin
              displayName
              avatarUrl
            }
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }`;

      const variables: FetchRecordsVariables = { first: 20 };
      if (after) variables.after = after;

      // Apply filters
      const filter: RecordFilter = {};
      if (searchTerm.trim()) filter.search = searchTerm.trim();
      if (locationFilter.trim()) filter.location = locationFilter.trim();
      if (Object.keys(filter).length > 0) variables.filter = filter;

      try {
        const res = await fetch('/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query, variables }),
        });

        const body = await res.json();

        if (body.errors) {
          setErrors(body.errors.map((e: any) => e.message));
          return;
        }

        const data: RecordsResponse = body.data?.records;
        if (data) {
          setRecords(data.edges.map((edge) => edge.node));
          setPageInfo(data.pageInfo);
          setTotalCount(data.totalCount);
        }
      } catch (err: any) {
        setErrors([err?.message ?? 'Failed to load records']);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, locationFilter]
  );

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleDelete = async (record: Record) => {
    setIsLoading(true);
    setErrors([]);

    const mutation = `mutation DeleteRecord($input: DeleteRecordInput!) {
      deleteRecord(input: $input) {
        deletedRecordId
        errors
      }
    }`;

    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: mutation,
          variables: { input: { id: record.id } },
        }),
      });

      const body = await res.json();

      if (body.errors) {
        setErrors(body.errors.map((e: any) => e.message));
        return;
      }

      const payload = body.data?.deleteRecord;
      if (payload?.errors && payload.errors.length > 0) {
        setErrors(payload.errors);
        return;
      }

      if (payload?.deletedRecordId) {
        // Remove from local state
        setRecords((prev) => prev.filter((r) => r.id !== record.id));
        setTotalCount((prev) => prev - 1);
      }
    } catch (err: any) {
      setErrors([err?.message ?? 'Failed to delete record']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (record: Record) => {
    setEditingRecord(record);
  };

  const handleSaveEdit = async (updates: RecordUpdates) => {
    if (!editingRecord) return;

    const mutation = `mutation UpdateRecord($input: UpdateRecordInput!) {
      updateRecord(input: $input) {
        record {
          id
          purchaseDate
          price
          condition
          location
          notes
          updatedAt
        }
        errors
      }
    }`;

    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          query: mutation,
          variables: {
            input: {
              id: editingRecord.id,
              ...updates,
            },
          },
        }),
      });

      const body = await res.json();

      if (body.errors) {
        throw new Error(body.errors[0]?.message || 'Failed to update record');
      }

      const payload = body.data?.updateRecord;
      if (payload?.errors && payload.errors.length > 0) {
        throw new Error(payload.errors[0]);
      }

      if (payload?.record) {
        // Update local state with new values
        setRecords((prev) =>
          prev.map((r) =>
            r.id === editingRecord.id
              ? {
                  ...r,
                  condition: payload.record.condition,
                  location: payload.record.location,
                  price: payload.record.price,
                  purchaseDate: payload.record.purchaseDate,
                  notes: payload.record.notes,
                  updatedAt: payload.record.updatedAt,
                }
              : r
          )
        );
        setToast({ message: 'Record updated successfully', type: 'success' });
        setEditingRecord(null);
      }
    } catch (err: any) {
      throw new Error(err?.message ?? 'Failed to update record');
    }
  };

  const handleLoadMore = () => {
    if (pageInfo.endCursor && pageInfo.hasNextPage) {
      fetchRecords(pageInfo.endCursor);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setLocationFilter('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Collection</h1>
              <p className="mt-1 text-sm text-gray-500">
                {totalCount} {totalCount === 1 ? 'record' : 'records'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                    Search
                  </label>
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search notes, condition, location..."
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label
                    htmlFor="location"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    placeholder="Filter by location..."
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Apply Filters
                </button>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <ErrorAlert errors={errors} onDismiss={() => setErrors([])} />
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && records.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              <p className="mt-2 text-sm text-gray-500">Loading your collection...</p>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No records found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || locationFilter
                ? 'Try adjusting your filters or search terms.'
                : 'Get started by scanning a barcode to add your first vinyl record.'}
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={onNavigateToScan}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Scan Barcode
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Records Grid */}
            <div className="space-y-4">
              {records.map((record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Load More Button */}
            {pageInfo.hasNextPage && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingRecord && (
        <RecordEditModal
          record={editingRecord}
          onSave={handleSaveEdit}
          onCancel={() => setEditingRecord(null)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

export default CollectionPage;
