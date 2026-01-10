import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RecordCard, type Record } from '../components/RecordCard';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { RecordEditModal, type RecordUpdates } from '../components/RecordEditModal';
import { Toast } from '../components/Toast';
import { useRecordsQuery, useDeleteRecordMutation, useUpdateRecordMutation } from '../hooks/relay';
import type { useRecordsQuery$data } from '../__generated__/useRecordsQuery.graphql';

type RecordEdge = useRecordsQuery$data['records']['edges'][number];

type RecordFilter = {
  artist?: string;
  title?: string;
  year?: number;
  format?: string;
  location?: string;
  search?: string;
};

export function CollectionPage() {
  const navigate = useNavigate();
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [after, setAfter] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<string[]>([]);

  // Build filter object
  const filter: RecordFilter = {};
  if (searchTerm.trim()) filter.search = searchTerm.trim();
  if (locationFilter.trim()) filter.location = locationFilter.trim();

  // Use Relay hook to fetch records
  const recordsData = useRecordsQuery({
    first: 20,
    after,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  const records = recordsData.edges.map((edge: RecordEdge) => edge.node as unknown as Record);
  const pageInfo = recordsData.pageInfo;
  const totalCount = recordsData.totalCount;

  const { mutate: deleteRecord, isLoading: isDeleting } = useDeleteRecordMutation();
  const { mutate: updateRecord, isLoading: isUpdating } = useUpdateRecordMutation();

  const isLoading = isDeleting || isUpdating;

  const handleDelete = async (record: Record) => {
    try {
      await deleteRecord({ id: record.id });
      setToast({ message: 'Record deleted successfully', type: 'success' });
      // Refresh by resetting pagination
      setAfter(undefined);
    } catch (err: any) {
      setToast({
        message: err?.message ?? 'Failed to delete record',
        type: 'error',
      });
    }
  };

  const handleEdit = (record: Record) => {
    setEditingRecord(record);
  };

  const handleSaveEdit = async (updates: RecordUpdates) => {
    if (!editingRecord) return;

    try {
      await updateRecord({
        id: editingRecord.id,
        ...updates,
      });
      setToast({ message: 'Record updated successfully', type: 'success' });
      setEditingRecord(null);
      // Refresh by resetting pagination
      setAfter(undefined);
    } catch (err: any) {
      throw new Error(err?.message ?? 'Failed to update record');
    }
  };

  const handleLoadMore = () => {
    if (pageInfo.endCursor && pageInfo.hasNextPage) {
      setAfter(pageInfo.endCursor);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAfter(undefined);
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
            {/* Records Grid */}
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

            {/* Load More Button */}
            {pageInfo.hasNextPage && (
              <div className="mt-8 text-center">
                <Button
                  onClick={handleLoadMore}
                  isDisabled={isLoading}
                  variant="secondary"
                  size="lg"
                  icon={isLoading ? <LoadingSpinner size="sm" color="secondary" /> : undefined}
                >
                  {isLoading ? 'Loading...' : 'Load More'}
                </Button>
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
