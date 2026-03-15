import { useState, useEffect, Suspense } from 'react';
import { useAlbumsQueryPreloaded } from '../../hooks/relay/useAlbumsQuery';
import { useAlbumsQueryLoader } from '../../hooks/relay/useAlbumsQueryLoader';
import { LoadingSpinner } from '../LoadingSpinner';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { useAlbumsQuery$data } from '../../__generated__/useAlbumsQuery.graphql';

type AlbumNode = useAlbumsQuery$data['albums']['edges'][number]['node'];

function AlbumCard({ album }: { album: AlbumNode }) {
  const initials = album.title.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
      {/* Cover image */}
      <div className="aspect-square w-full bg-gray-100 overflow-hidden">
        {album.coverImageUrl ? (
          <img
            src={album.coverImageUrl}
            alt={`${album.title} by ${album.artist}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-500 to-gray-700">
            <span className="text-4xl font-bold text-white opacity-80">{initials}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 truncate text-sm leading-snug">{album.title}</h3>
        <p className="text-xs text-gray-600 truncate mt-0.5">{album.artist}</p>
        <div className="flex flex-wrap gap-1 mt-1.5 items-center">
          {album.year && (
            <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-medium">
              {album.year}
            </span>
          )}
          {album.format && (
            <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 font-medium">
              {album.format}
            </span>
          )}
          <span className="inline-block px-1.5 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 font-medium ml-auto">
            {album.recordCount} {album.recordCount === 1 ? 'copy' : 'copies'}
          </span>
        </div>
      </div>
    </div>
  );
}

function AlbumsGrid({ queryRef, onLoadMore }: { queryRef: any; onLoadMore: (cursor: string) => void }) {
  const albums = useAlbumsQueryPreloaded(queryRef);

  if (albums.edges.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <p className="mt-3 text-sm text-gray-500">No albums found</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {albums.edges.map(({ node }) => (
          <AlbumCard key={node.id} album={node} />
        ))}
      </div>
      {albums.pageInfo.hasNextPage && albums.pageInfo.endCursor && (
        <div className="mt-8 text-center">
          <Button variant="secondary" size="lg" onClick={() => onLoadMore(albums.pageInfo.endCursor!)}>
            Load More
          </Button>
        </div>
      )}
    </>
  );
}

export function AlbumsView() {
  const { queryRef, loadQuery, refetch } = useAlbumsQueryLoader();
  const [search, setSearch] = useState('');
  const [artistFilter, setArtistFilter] = useState('');

  useEffect(() => {
    loadQuery({ first: 24 }, { fetchPolicy: 'network-only' });
  }, [loadQuery]);

  const buildFilter = () => {
    const f: { search?: string; artist?: string } = {};
    if (search.trim()) f.search = search.trim();
    if (artistFilter.trim()) f.artist = artistFilter.trim();
    return Object.keys(f).length ? f : undefined;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch({ first: 24, filter: buildFilter() });
  };

  const handleLoadMore = (cursor: string) => {
    refetch({ first: 24, after: cursor, filter: buildFilter() });
  };

  const handleClear = () => {
    setSearch('');
    setArtistFilter('');
    refetch({ first: 24 });
  };

  if (!queryRef) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" color="primary" />
      </div>
    );
  }

  const hasFilters = search.trim() || artistFilter.trim();

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-2">
        <div className="flex gap-2">
          <Input
            id="album-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search albums…"
            fullWidth
          />
          <Input
            id="album-artist"
            type="text"
            value={artistFilter}
            onChange={(e) => setArtistFilter(e.target.value)}
            placeholder="by artist…"
            fullWidth
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Search</Button>
          {hasFilters && (
            <Button type="button" variant="secondary" onClick={handleClear}>
              Clear
            </Button>
          )}
        </div>
      </form>

      <Suspense fallback={<div className="flex justify-center py-16"><LoadingSpinner size="lg" color="primary" /></div>}>
        <AlbumsGrid queryRef={queryRef} onLoadMore={handleLoadMore} />
      </Suspense>
    </div>
  );
}
