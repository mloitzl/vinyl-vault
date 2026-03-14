import { useSearchParams } from 'react-router-dom';
import { ArtistsView } from '../components/browse/ArtistsView';
import { AlbumsView } from '../components/browse/AlbumsView';
import { GenresView } from '../components/browse/GenresView';

type BrowseTab = 'artists' | 'albums' | 'genres';

const TABS: { id: BrowseTab; label: string }[] = [
  { id: 'artists', label: 'Artists' },
  { id: 'albums', label: 'Albums' },
  { id: 'genres', label: 'Genres' },
];

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as BrowseTab) || 'artists';

  const handleTabChange = (tab: BrowseTab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Browse</h1>
          <p className="mt-1 text-sm text-gray-500">Explore your collection by artist, album, or genre</p>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 border-b border-transparent -mb-px">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'artists' && <ArtistsView />}
        {activeTab === 'albums' && <AlbumsView />}
        {activeTab === 'genres' && <GenresView />}
      </div>
    </div>
  );
}

export default BrowsePage;
