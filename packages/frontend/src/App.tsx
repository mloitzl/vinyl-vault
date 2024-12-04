import { useState } from 'react';
import { RelayEnvironmentProvider } from 'react-relay';
import { RelayEnvironment } from './relay/environment';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header, ErrorAlert, LoadingSpinner, ScanBarcode } from './components';

type ActiveView = 'home' | 'scan' | 'collection' | 'search';

function AppContent() {
  const { user, isLoading, error } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('home');

  // Navigation items
  const navItems: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    {
      id: 'scan',
      label: 'Scan',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m14 0h2M4 4h4m12 0h2M4 20h4m12 0h2M8 8h.01M16 8h.01M8 16h.01M16 16h.01" />
        </svg>
      ),
    },
    {
      id: 'collection',
      label: 'Collection',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
  ];

  // Render the active view content
  const renderContent = () => {
    if (!user) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Vinyl Vault</h2>
            <p className="text-gray-500 mb-6">
              Manage your vinyl collection with ease. Scan barcodes to fetch album info from Discogs and MusicBrainz.
            </p>
            <p className="text-sm text-gray-400">Sign in with GitHub to get started</p>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case 'scan':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 bg-white">
              <h1 className="text-lg font-semibold text-gray-900">Scan Barcode</h1>
              <p className="text-sm text-gray-500">Add a record to your collection</p>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50">
              <ScanBarcode />
            </div>
          </div>
        );

      case 'collection':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 bg-white">
              <h1 className="text-lg font-semibold text-gray-900">My Collection</h1>
              <p className="text-sm text-gray-500">Browse your vinyl records</p>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <h3 className="text-gray-900 font-medium mb-1">No records yet</h3>
                <p className="text-sm text-gray-500 mb-4">Start by scanning a barcode to add your first record</p>
                <button
                  onClick={() => setActiveView('scan')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m14 0h2M4 4h4m12 0h2M4 20h4m12 0h2M8 8h.01M16 8h.01M8 16h.01M16 16h.01" />
                  </svg>
                  Scan Barcode
                </button>
              </div>
            </div>
          </div>
        );

      case 'search':
        return (
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-200 bg-white">
              <h1 className="text-lg font-semibold text-gray-900">Search</h1>
              <p className="text-sm text-gray-500">Find records in your collection</p>
            </div>
            <div className="p-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by artist, album, or barcode..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div className="mt-8 text-center text-gray-400 text-sm">
                <p>Enter a search term to find records</p>
              </div>
            </div>
          </div>
        );

      default: // home
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
                onClick={() => setActiveView('scan')}
                className="w-full bg-gray-900 text-white rounded-xl p-5 text-left hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h2M4 12h2m14 0h2M4 4h4m12 0h2M4 20h4m12 0h2M8 8h.01M16 8h.01M8 16h.01M16 16h.01" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Scan Barcode</div>
                    <div className="text-sm text-gray-300">Add a new record to your collection</div>
                  </div>
                  <svg className="w-5 h-5 ml-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Collection Card */}
              <button
                onClick={() => setActiveView('collection')}
                className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">My Collection</div>
                    <div className="text-sm text-gray-500">Browse your vinyl records</div>
                  </div>
                  <svg className="w-5 h-5 ml-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Search Card */}
              <button
                onClick={() => setActiveView('search')}
                className="w-full bg-white border border-gray-200 rounded-xl p-5 text-left hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Search</div>
                    <div className="text-sm text-gray-500">Find specific records</div>
                  </div>
                  <svg className="w-5 h-5 ml-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            </div>

            {/* Quick Stats - Mobile only (desktop shows in sidebar) */}
            <div className="mt-6 grid grid-cols-2 gap-3 md:hidden">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-semibold text-gray-900">0</div>
                <div className="text-sm text-gray-500">Records</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-semibold text-gray-900">0</div>
                <div className="text-sm text-gray-500">Artists</div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100">
          <ErrorAlert message={error} />
        </div>
      )}

      {/* Main content */}
      {isLoading ? (
        <div className="flex-1 flex justify-center items-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="flex-1 flex">
          {/* Desktop Sidebar Navigation - visible on md and up */}
          {user && (
            <aside className="hidden md:flex md:flex-col md:w-56 lg:w-64 border-r border-gray-200 bg-white">
              <nav className="flex-1 p-4 space-y-1">
                <button
                  onClick={() => setActiveView('home')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    activeView === 'home'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="font-medium">Home</span>
                </button>
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      activeView === item.id
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="w-5 h-5">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>

              {/* Desktop sidebar footer with stats */}
              <div className="p-4 border-t border-gray-100">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg py-2">
                    <div className="text-lg font-semibold text-gray-900">0</div>
                    <div className="text-xs text-gray-500">Records</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg py-2">
                    <div className="text-lg font-semibold text-gray-900">0</div>
                    <div className="text-xs text-gray-500">Artists</div>
                  </div>
                </div>
              </div>
            </aside>
          )}

          {/* Main content area */}
          <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto md:mx-0 md:max-w-none">
            {renderContent()}
          </main>
        </div>
      )}

      {/* Bottom Navigation - Mobile only, authenticated users */}
      {user && (
        <nav className="sticky bottom-0 bg-white border-t border-gray-200 md:hidden">
          <div className="flex justify-around">
            <button
              onClick={() => setActiveView('home')}
              className={`flex-1 flex flex-col items-center py-2 px-3 ${
                activeView === 'home' ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-xs mt-1">Home</span>
            </button>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`flex-1 flex flex-col items-center py-2 px-3 ${
                  activeView === item.id ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {item.icon}
                <span className="text-xs mt-1">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}

function App() {
  return (
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </RelayEnvironmentProvider>
  );
}

export default App;
