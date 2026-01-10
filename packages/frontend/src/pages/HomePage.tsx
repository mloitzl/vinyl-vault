import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface HomePageProps {
  recordCount: number;
  artistCount: number;
}

export function HomePage({ recordCount, artistCount }: HomePageProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Vinyl Vault</h2>
          <p className="text-gray-500 mb-6">
            Manage your vinyl collection with ease. Scan barcodes to fetch album info from Discogs
            and MusicBrainz.
          </p>
          <p className="text-sm text-gray-400">Sign in with GitHub to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Hi, {user.displayName.split(' ')[0]}
        </h1>
        <p className="text-gray-500">What would you like to do?</p>
      </div>

      <div className="space-y-3">
        {/* Scan Card - Primary Action */}
        <button
          onClick={() => navigate('/scan')}
          className="w-full bg-gray-900 text-white rounded-xl p-5 text-left hover:bg-gray-800 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m14 0h2M4 4h4m12 0h2M4 20h4m12 0h2M8 8h.01M16 8h.01M8 16h.01M16 16h.01"
                />
              </svg>
            </div>
            <div>
              <div className="font-medium">Scan Barcode</div>
              <div className="text-sm text-gray-300">Add a new record to your collection</div>
            </div>
            <svg
              className="w-5 h-5 ml-auto text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Collection Card */}
        <button
          onClick={() => navigate('/collection')}
          className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">My Collection</div>
              <div className="text-sm text-gray-500">Browse your vinyl records</div>
            </div>
            <svg
              className="w-5 h-5 ml-auto text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Search Card */}
        <button
          onClick={() => navigate('/search')}
          className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <div>
              <div className="font-medium text-gray-900">Search</div>
              <div className="text-sm text-gray-500">Find specific records</div>
            </div>
            <svg
              className="w-5 h-5 ml-auto text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>

      {/* Quick Stats - Mobile only (desktop shows in sidebar) */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:hidden">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-semibold text-gray-900">{recordCount}</div>
          <div className="text-sm text-gray-500">Records</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-semibold text-gray-900">{artistCount}</div>
          <div className="text-sm text-gray-500">Artists</div>
        </div>
      </div>
    </div>
  );
}
