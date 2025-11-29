import { RelayEnvironmentProvider } from 'react-relay';
import { RelayEnvironment } from './relay/environment';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header, ErrorAlert, LoadingSpinner } from './components';

function AppContent() {
  const { user, isLoading, error } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Error display */}
        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} />
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : user ? (
          /* Authenticated content */
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Welcome back, {user.displayName}! 👋
            </h2>
            <p className="text-gray-600 mb-4">
              Your vinyl collection awaits. Start by scanning a barcode or browsing your records.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">📀</div>
                <h3 className="font-medium text-gray-900">My Records</h3>
                <p className="text-sm text-gray-500">Browse your collection</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">📷</div>
                <h3 className="font-medium text-gray-900">Scan Barcode</h3>
                <p className="text-sm text-gray-500">Add a new record</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">🔍</div>
                <h3 className="font-medium text-gray-900">Search</h3>
                <p className="text-sm text-gray-500">Find specific records</p>
              </div>
            </div>
          </div>
        ) : (
          /* Unauthenticated content */
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">💿</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to Vinyl Vault
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Manage your vinyl record collection with ease. Scan barcodes to automatically 
              fetch album information from Discogs and MusicBrainz.
            </p>
            <p className="text-sm text-gray-500">
              Sign in with GitHub to get started.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-4 text-center text-sm text-gray-500">
        <p>Vinyl Vault &copy; {new Date().getFullYear()}</p>
      </footer>
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
