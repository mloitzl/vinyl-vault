import { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGenresQuery } from '../../hooks/relay/useGenresQuery';
import { LoadingSpinner } from '../LoadingSpinner';

function GenreChip({ name, recordCount }: { name: string; recordCount: number }) {
  const navigate = useNavigate();
  // Map record count to a size class — more records → larger chip
  const sizeClass =
    recordCount >= 20 ? 'text-base px-4 py-2' :
    recordCount >= 10 ? 'text-sm px-3 py-1.5' :
    'text-xs px-2.5 py-1';

  return (
    <button
      onClick={() => navigate(`/collection?search=${encodeURIComponent(name)}`)}
      className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100 transition-colors ${sizeClass}`}
    >
      {name}
      <span className="bg-emerald-200 text-emerald-900 rounded-full px-1.5 py-0.5 text-xs font-semibold">
        {recordCount}
      </span>
    </button>
  );
}

function GenreList() {
  const genres = useGenresQuery();
  const sorted = [...genres].sort((a, b) => b.recordCount - a.recordCount);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">No genres in your collection yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {sorted.map((genre) => (
        <GenreChip key={genre.name} name={genre.name} recordCount={genre.recordCount} />
      ))}
    </div>
  );
}

export function GenresView() {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Click a genre to browse matching records in your collection.
      </p>
      <Suspense fallback={<div className="flex justify-center py-16"><LoadingSpinner size="lg" color="primary" /></div>}>
        <GenreList />
      </Suspense>
    </div>
  );
}
