import { useEffect, Suspense } from 'react';
import { useRecordsQueryPreloaded } from '../../hooks/relay';
import { useRecordsQueryLoader } from '../../hooks/relay/useRecordsQueryLoader';
import { useRecordActions } from '../../hooks/useRecordActions';
import { RecordCard, type Record } from '../RecordCard';
import { RecordEditModal } from '../RecordEditModal';
import { LoadingSpinner } from '../LoadingSpinner';
import { Button } from '../ui/Button';
import type { useRecordsQuery$data } from '../../__generated__/useRecordsQuery.graphql';

type RecordEdge = useRecordsQuery$data['records']['edges'][number];

function GenreRecordList({
  queryRef,
  genre,
  onLoadMore,
  onEdit,
  onDelete,
}: {
  queryRef: any;
  genre: string;
  onLoadMore: (cursor: string) => void;
  onEdit: (record: Record) => void;
  onDelete: (record: Record) => void;
}) {
  const recordsData = useRecordsQueryPreloaded(queryRef);
  const records = recordsData.edges.map((edge: RecordEdge) => edge.node as unknown as Record);

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
        {recordsData.totalCount} {recordsData.totalCount === 1 ? 'record' : 'records'}
      </p>
      <div className="space-y-4">
        {records.map((record: Record) => (
          <RecordCard key={record.id} record={record} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
      {recordsData.pageInfo.hasNextPage && recordsData.pageInfo.endCursor && (
        <div className="mt-8 text-center">
          <Button variant="secondary" size="lg" onClick={() => onLoadMore(recordsData.pageInfo.endCursor!)}>
            Load More
          </Button>
        </div>
      )}
    </>
  );
}

export function GenreRecordsView({ genre, onBack }: { genre: string; onBack: () => void }) {
  const { queryRef, loadQuery, refetch } = useRecordsQueryLoader();

  useEffect(() => {
    loadQuery({ first: 20, filter: { genre } });
  }, [genre, loadQuery]);

  const handleLoadMore = (cursor: string) => {
    refetch({ first: 20, after: cursor, filter: { genre } });
  };

  const doRefetch = () => refetch({ first: 20, filter: { genre } });
  const { editingRecord, handleEdit, handleDelete, handleSaveEdit, handleCancelEdit } =
    useRecordActions(doRefetch);

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
        <span
          className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-sm"
        >
          {genre}
        </span>
      </div>

      {!queryRef ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" color="primary" />
        </div>
      ) : (
        <Suspense fallback={<div className="flex justify-center py-16"><LoadingSpinner size="lg" color="primary" /></div>}>
          <GenreRecordList
            queryRef={queryRef}
            genre={genre}
            onLoadMore={handleLoadMore}
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
