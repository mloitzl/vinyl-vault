import { useEffect, useState, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { RecordCard, type Record } from '../components/RecordCard';
import { RecordEditModal } from '../components/RecordEditModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Button } from '../components/ui/Button';
import { useRecordsQueryPreloaded, useRecordListPagination } from '../hooks/relay';
import { useRecordsQueryLoader } from '../hooks/relay/useRecordsQueryLoader';
import { useRecordActions } from '../hooks/useRecordActions';
import type { useRecordsQuery_records$data } from '../__generated__/useRecordsQuery_records.graphql';

type RecordEdge = useRecordsQuery_records$data['records']['edges'][number];

function ArtistRecords({
  fragmentRef,
  artistName,
  onEdit,
  onDelete,
}: {
  fragmentRef: any;
  artistName: string;
  onEdit?: (record: Record) => void;
  onDelete?: (record: Record) => void;
}) {
  const navigate = useNavigate();
  const { data, loadNext, hasNext, isLoadingNext } = useRecordListPagination(fragmentRef);
  const records = data.records.edges.map((edge: RecordEdge) => edge.node as unknown as Record);

  // Derive artist cover image and genres from records
  const artistThumbnailUrls = [
    ...new Set(records.flatMap((r) => r.release?.artistThumbnailUrls ?? [])),
  ];
  const coverImageUrl = records.find((r) => r.release?.coverImageUrl)?.release?.coverImageUrl;
  const genres = [
    ...new Set(records.flatMap((r) => r.release?.genre ?? [])),
  ].slice(0, 5);

  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  useEffect(() => {
    setThumbnailIndex(0);
    if (artistThumbnailUrls.length <= 1) return;
    const id = setInterval(() => setThumbnailIndex((i) => (i + 1) % artistThumbnailUrls.length), 5000);
    return () => clearInterval(id);
  }, [artistName, artistThumbnailUrls.length]);

  const imageSrc = artistThumbnailUrls[thumbnailIndex] ?? coverImageUrl ?? null;

  if (records.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">No records found for this artist.</p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/browse?tab=artists')}>
            Back to Artists
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Artist Hero */}
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 shadow">
              {imageSrc ? (
                <img src={imageSrc} alt={artistName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700">
                  <span className="text-3xl font-bold text-white">
                    {artistName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{artistName}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {data.records.totalCount} {data.records.totalCount === 1 ? 'record' : 'records'}
              </p>
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {genres.map((g) => (
                    <span
                      key={g}
                      className="inline-block px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 font-medium"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
            onClick={() => loadNext(50)}
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

function ArtistDetailPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <LoadingSpinner size="lg" color="primary" />
    </div>
  );
}

// Wrapper inside Suspense: resolves the preloaded query into a fragment ref
function ArtistRecordsWrapper({
  queryRef,
  artistName,
  onEdit,
  onDelete,
}: {
  queryRef: any;
  artistName: string;
  onEdit?: (record: Record) => void;
  onDelete?: (record: Record) => void;
}) {
  const fragmentRef = useRecordsQueryPreloaded(queryRef);
  return <ArtistRecords fragmentRef={fragmentRef} artistName={artistName} onEdit={onEdit} onDelete={onDelete} />;
}

export function ArtistDetailPage() {
  const { name } = useParams<{ name: string }>();
  const artistName = name ? decodeURIComponent(name) : '';
  const { queryRef, loadQuery } = useRecordsQueryLoader();

  useEffect(() => {
    if (artistName) {
      loadQuery({ first: 50, filter: { artist: artistName } });
    }
  }, [artistName, loadQuery]);

  const filter = artistName ? { artist: artistName } : undefined;
  const { editingRecord, handleEdit, handleDelete, handleSaveEdit, handleCancelEdit } =
    useRecordActions(filter);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/browse?tab=artists" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Artists
            </Link>
            <span className="text-gray-400">›</span>
            <span className="text-gray-700 font-medium truncate">{artistName}</span>
          </nav>
        </div>
      </div>

      {!queryRef ? (
        <ArtistDetailPageLoading />
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <Suspense fallback={<ArtistDetailPageLoading />}>
            <ArtistRecordsWrapper
              queryRef={queryRef}
              artistName={artistName}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </Suspense>
        </div>
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

export default ArtistDetailPage;
