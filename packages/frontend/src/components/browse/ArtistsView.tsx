import { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArtistsQueryPreloaded } from '../../hooks/relay/useArtistsQuery';
import { useArtistsQueryLoader } from '../../hooks/relay/useArtistsQueryLoader';
import { LoadingSpinner } from '../LoadingSpinner';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { useArtistsQuery$data } from '../../__generated__/useArtistsQuery.graphql';

type ArtistNode = useArtistsQuery$data['artists']['edges'][number]['node'];

function ArtistCard({ artist, tick }: { artist: ArtistNode; tick: number }) {
  const navigate = useNavigate();
  const initials = artist.name.slice(0, 2).toUpperCase();
  const thumbnails = artist.artistThumbnailUrls ?? [];
  const thumbnailIndex = thumbnails.length > 1 ? tick % thumbnails.length : 0;
  const imageSrc = thumbnails[thumbnailIndex] ?? artist.coverImageUrl ?? null;

  return (
    <button
      onClick={() => navigate(`/artists/${encodeURIComponent(artist.name)}`)}
      className="group flex flex-col bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:border-emerald-200 transition-all text-left w-full"
    >
      {/* Cover image */}
      <div className="aspect-square w-full bg-gray-100 overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={artist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-700">
            <span className="text-4xl font-bold text-white opacity-80">{initials}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="font-semibold text-gray-900 truncate text-sm">{artist.name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {artist.recordCount} {artist.recordCount === 1 ? 'record' : 'records'}
        </p>
        {artist.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {artist.genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="inline-block px-1.5 py-0.5 rounded text-xs bg-emerald-50 text-emerald-700 font-medium"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function ArtistsGrid({ queryRef, onLoadMore }: { queryRef: any; onLoadMore: (cursor: string) => void }) {
  const artists = useArtistsQueryPreloaded(queryRef);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  if (artists.edges.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
        <p className="mt-3 text-sm text-gray-500">No artists found</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {artists.edges.map(({ node }) => (
          <ArtistCard key={node.id} artist={node} tick={tick} />
        ))}
      </div>
      {artists.pageInfo.hasNextPage && artists.pageInfo.endCursor && (
        <div className="mt-8 text-center">
          <Button variant="secondary" size="lg" onClick={() => onLoadMore(artists.pageInfo.endCursor!)}>
            Load More
          </Button>
        </div>
      )}
    </>
  );
}

export function ArtistsView() {
  const { queryRef, loadQuery, refetch } = useArtistsQueryLoader();
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadQuery({ first: 24 }, { fetchPolicy: 'network-only' });
  }, [loadQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch({ first: 24, filter: search.trim() ? { search: search.trim() } : undefined });
  };

  const handleLoadMore = (cursor: string) => {
    refetch({ first: 24, after: cursor, filter: search.trim() ? { search: search.trim() } : undefined });
  };

  if (!queryRef) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          id="artist-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search artists…"
          fullWidth
        />
        <Button type="submit" variant="primary">Search</Button>
        {search && (
          <Button type="button" variant="secondary" onClick={() => { setSearch(''); refetch({ first: 24 }); }}>
            Clear
          </Button>
        )}
      </form>

      <Suspense fallback={<div className="flex justify-center py-16"><LoadingSpinner size="lg" color="primary" /></div>}>
        <ArtistsGrid queryRef={queryRef} onLoadMore={handleLoadMore} />
      </Suspense>
    </div>
  );
}
