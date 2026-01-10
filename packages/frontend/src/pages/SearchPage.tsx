import { useAuth } from '../contexts/AuthContext';

export function SearchPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-gray-500">Please sign in to search your collection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Search</h1>
        <p className="text-sm text-gray-500">Find records in your collection</p>
      </div>
      <div className="p-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by artist, album, or barcode..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Enter a search term to find records</p>
          <p className="text-xs mt-2">Full search functionality coming in Phase 2</p>
        </div>
      </div>
    </div>
  );
}
