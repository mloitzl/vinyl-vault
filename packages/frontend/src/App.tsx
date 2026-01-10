import { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RelayEnvironmentProvider } from 'react-relay';
import { RelayEnvironment } from './relay/environment';
import { AuthProvider, useAuth, ToastProvider, LoadingProvider } from './contexts';
import { useRecordsQuery } from './hooks/relay';
import {
  Header,
  LoadingSpinner,
  OrgInstalledNotification,
  DesktopNavigation,
  MobileNavigation,
  RelayErrorBoundary,
  ToastContainer,
} from './components';
import { Alert } from './components/ui/Alert';
import {
  HomePage,
  ScanPage,
  CollectionPage,
  SearchPage,
  RecordDetailPage,
  NotFoundPage,
} from './pages';

function AuthedContent() {
  const [recordCount, setRecordCount] = useState(0);
  const [artistCount, setArtistCount] = useState(0);
  const recordsData = useRecordsQuery({ first: 1000 });

  useEffect(() => {
    if (recordsData && recordsData.edges) {
      setRecordCount(recordsData.totalCount);
      const artists = new Set(
        recordsData.edges
          .map((edge: any) => edge.node.release?.artist)
          .filter((artist: any) => artist)
      );
      setArtistCount(artists.size);
    }
  }, [recordsData]);

  return (
    <div className="flex-1 flex">
      <DesktopNavigation recordCount={recordCount} artistCount={artistCount} />
      <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto md:mx-0 md:max-w-none">
        <RelayErrorBoundary>
          <Suspense
            fallback={
              <div className="flex-1 flex justify-center items-center">
                <LoadingSpinner size="lg" />
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={<HomePage recordCount={recordCount} artistCount={artistCount} />}
              />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/collection" element={<CollectionPage />} />
              <Route path="/collection/:recordId" element={<RecordDetailPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </RelayErrorBoundary>
      </main>
    </div>
  );
}

function AppContent() {
  const { user, isLoading, error, refreshUser } = useAuth();
  const [orgInstalled, setOrgInstalled] = useState<string | null>(null);

  // Detect org_installed query parameter from GitHub App installation redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installed = params.get('org_installed');

    if (installed) {
      setOrgInstalled(installed);

      // Refresh user/tenants to pick up the newly created org tenant from /auth/me
      refreshUser().catch((err) => console.warn('Failed to refresh user after install:', err));

      // Clean up URL without reloading page
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refreshUser]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      {/* Error display */}
      {error && (
        <div className="px-4">
          <Alert type="error" onDismiss={() => refreshUser()}>
            {error}
          </Alert>
        </div>
      )}

      {/* Organization Installation Success Notification */}
      {orgInstalled && (
        <OrgInstalledNotification orgName={orgInstalled} onDismiss={() => setOrgInstalled(null)} />
      )}

      {/* Main content */}
      {isLoading ? (
        <div className="flex-1 flex justify-center items-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : user ? (
        <AuthedContent />
      ) : (
        <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto md:mx-0 md:max-w-none">
          <Routes>
            <Route path="/" element={<HomePage recordCount={0} artistCount={0} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      )}

      {/* Bottom Navigation - Mobile only, authenticated users */}
      {user && <MobileNavigation />}

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <ToastProvider>
        <LoadingProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </AuthProvider>
        </LoadingProvider>
      </ToastProvider>
    </RelayEnvironmentProvider>
  );
}

export default App;
