import { useState, useEffect, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RecordCard, type Record } from '../components/RecordCard';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { RecordEditModal } from '../components/RecordEditModal';
import { useRecordsQueryPreloaded, useRecordListPagination } from '../hooks/relay';
import { useRecordsQueryLoader } from '../hooks/relay/useRecordsQueryLoader';
import { useRecordActions } from '../hooks/useRecordActions';
import type { useRecordsQuery_records$data } from '../__generated__/useRecordsQuery_records.graphql';

type RecordEdge = useRecordsQuery_records$data['records']['edges'][number];

type RecordFilter = {
  location?: string;
  search?: string;
};

export function CollectionPage() {
  const [urlSearchParams] = useSearchParams();
  const { queryRef, loadQuery } = useRecordsQueryLoader();

  const initialSearch = urlSearchParams.get('search') ?? '';

  useEffect(() => {
    loadQuery({ first: 20, ...(initialSearch ? { filter: { search: initialSearch } } : {}) });
  }, [loadQuery]);

  if (!queryRef) {
    return <CollectionPageLoading />;
  }

  return (
    <Suspense fallback={<CollectionPageLoading />}>
      <CollectionPageWrapper queryRef={queryRef} initialSearch={initialSearch} />
    </Suspense>
  );
}

// Wrapper inside Suspense: resolves the preloaded query into a fragment ref
function CollectionPageWrapper({ queryRef, initialSearch }: { queryRef: any; initialSearch: string }) {
  const fragmentRef = useRecordsQueryPreloaded(queryRef);
  return <CollectionPageContent fragmentRef={fragmentRef} initialSearch={initialSearch} />;
}

function CollectionPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <LoadingSpinner size="lg" color="primary" />
    </div>
  );
}

function CollectionPageContent({
  fragmentRef,
  initialSearch,
}: {
  fragmentRef: any;
  initialSearch: string;
}) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [locationFilter, setLocationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const { data, loadNext, hasNext, isLoadingNext, refetch } = useRecordListPagination(fragmentRef);

  const currentFilter: RecordFilter = {};
  if (searchTerm.trim()) currentFilter.search = searchTerm.trim();
  if (locationFilter.trim()) currentFilter.location = locationFilter.trim();

  const { editingRecord, isLoading, handleEdit, handleDelete, handleSaveEdit, handleCancelEdit } =
    useRecordActions(Object.keys(currentFilter).length > 0 ? currentFilter : undefined);

  const records = data.records.edges.map((edge: RecordEdge) => edge.node as unknown as Record);
  const totalCount = data.records.totalCount;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch(
      { first: 20, filter: Object.keys(currentFilter).length > 0 ? currentFilter : undefined },
      { fetchPolicy: 'network-only' }
    );
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setLocationFilter('');
    refetch({ first: 20 }, { fetchPolicy: 'network-only' });
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
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              }
            >
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Search"
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search notes, condition, location..."
                  fullWidth
                />
                <Input
                  label="Location"
                  id="location"
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="Filter by location..."
                  fullWidth
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="primary">
                  Apply Filters
                </Button>
                <Button type="button" onClick={handleClearFilters} variant="secondary">
                  Clear
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-2">
          {errors.map((error, idx) => (
            <Alert
              key={idx}
              type="error"
              onDismiss={() => setErrors(errors.filter((_, i) => i !== idx))}
            >
              {error}
            </Alert>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && records.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <LoadingSpinner size="lg" color="primary" />
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
              <Button
                onClick={() => navigate('/scan')}
                variant="primary"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                }
              >
                Scan Barcode
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {records.map((record: Record) => (
                <RecordCard
                  key={record.id}
                  record={record}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {hasNext && (
              <div className="mt-8 text-center">
                <Button
                  onClick={() => loadNext(20)}
                  isDisabled={isLoadingNext}
                  variant="secondary"
                  size="lg"
                  icon={isLoadingNext ? <LoadingSpinner size="sm" color="secondary" /> : undefined}
                >
                  {isLoadingNext ? 'Loading...' : 'Load More'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {editingRecord && (
        <RecordEditModal
          record={editingRecord}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}

export default CollectionPage;

