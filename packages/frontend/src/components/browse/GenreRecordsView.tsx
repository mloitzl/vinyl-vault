import { useEffect, Suspense } from 'react';
import { useRecordsQueryPreloaded, useRecordListPagination } from '../../hooks/relay';
import { useRecordsQueryLoader } from '../../hooks/relay/useRecordsQueryLoader';
import { useRecordActions } from '../../hooks/useRecordActions';
import { RecordCard, type Record } from '../RecordCard';
import { RecordEditModal } from '../RecordEditModal';
import { LoadingSpinner } from '../LoadingSpinner';
import { Button } from '../ui/Button';
import type { useRecordsQuery_records$data } from '../../__generated__/useRecordsQuery_records.graphql';

type RecordEdge = useRecordsQuery_records$data['records']['edges'][number];

function GenreRecordList({
  fragmentRef,
  genre,
  onEdit,
  onDelete,
}: {
  fragmentRef: any;
  genre: string;
  onEdit?: (record: Record) => void;
  onDelete?: (record: Record) => void;
}) {
  const { data, loadNext, hasNext, isLoadingNext } = useRecordListPagination(fragmentRef);
  const records = data.records.edges.map((edge: RecordEdge) => edge.node as unknown as Record);

  if (records.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">No records found for &ldquo;{genre}&rdquo;.</p>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-gray-500 mb-4">
        {data.records.totalCount} {data.records.totalCount === 1 ? 'record' : 'records'}
      </p>
      <div className="space-y-4">
        {records.map((record: Record) => (
          <RecordCard key={record.id} record={record} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
      {hasNext && (
        <div className="mt-8 text-center">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => loadNext(20)}
            isDisabled={isLoadingNext}
            icon={isLoadingNext ? <LoadingSpinner size="sm" color="secondary" /> : undefined}
          >
            {isLoadingNext ? 'Loading…' : 'Load More'}
          </Button>
        </div>
      )}
    </>
  );
}

// Wrapper inside Suspense: resolves the preloaded query into a fragment ref
function GenreRecordListWrapper({
  queryRef,
  genre,
  onEdit,
  onDelete,
}: {
  queryRef: any;
  genre: string;
  onEdit?: (record: Record) => void;
  onDelete?: (record: Record) => void;
}) {
  const fragmentRef = useRecordsQueryPreloaded(queryRef);
  return <GenreRecordList fragmentRef={fragmentRef} genre={genre} onEdit={onEdit} onDelete={onDelete} />;
}

export function GenreRecordsView({ genre, onBack }: { genre: string; onBack: () => void }) {
  const { queryRef, loadQuery } = useRecordsQueryLoader();

  useEffect(() => {
    loadQuery({ first: 20, filter: { genre } });
  }, [genre, loadQuery]);

  const { editingRecord, handleEdit, handleDelete, handleSaveEdit, handleCancelEdit } =
    useRecordActions({ genre });

  return (
    <div>
      {/* Genre header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Genres
        </button>
        <span className="text-gray-300">›</span>
        <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-sm">
          {genre}
        </span>
      </div>

      {!queryRef ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" color="primary" />
        </div>
      ) : (
        <Suspense fallback={<div className="flex justify-center py-16"><LoadingSpinner size="lg" color="primary" /></div>}>
          <GenreRecordListWrapper
            queryRef={queryRef}
            genre={genre}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </Suspense>
      )}

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
