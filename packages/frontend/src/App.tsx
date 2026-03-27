import { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RelayEnvironmentProvider, useLazyLoadQuery, graphql } from 'react-relay';
import { RelayEnvironment } from './relay/environment';
import { AuthProvider, useAuth, ToastProvider, LoadingProvider } from './contexts';
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
  BrowsePage,
  ArtistDetailPage,
  SocialPage,
} from './pages';
import type { AppCountsQuery as AppCountsQueryType } from './__generated__/AppCountsQuery.graphql';

const AppCountsQuery = graphql`
  query AppCountsQuery {
    records(first: 1) {
      totalCount
    }
    artists(first: 1) {
      totalCount
    }
  }
`;

function AuthedContent() {
  const data = useLazyLoadQuery<AppCountsQueryType>(AppCountsQuery, {});
  const recordCount = data.records?.totalCount ?? 0;
  const artistCount = data.artists?.totalCount ?? 0;

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
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/artists/:name" element={<ArtistDetailPage />} />
              <Route path="/social" element={<SocialPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </RelayErrorBoundary>
      </main>
    </div>
  );
}

function AppContent() {
  const { user, isLoading, error, refreshUser, activeTenant } = useAuth();
  const [orgInstalled, setOrgInstalled] = useState<string | null>(null);

  const isForeignTenant = !!(user && activeTenant && activeTenant.id !== `user_${user.id}`);
  const isFriendCollection = isForeignTenant && activeTenant?.type === 'USER' && activeTenant?.role === 'VIEWER';
  const isOrgViewer = isForeignTenant && activeTenant?.type === 'ORGANIZATION' && activeTenant?.role === 'VIEWER';
  const isOrgMember = isForeignTenant && activeTenant?.type === 'ORGANIZATION' && activeTenant?.role !== 'VIEWER';
  const ringClass = isFriendCollection
    ? 'ring-4 ring-inset ring-slate-400'
    : isOrgViewer
    ? 'ring-4 ring-inset ring-amber-400'
    : isOrgMember
    ? 'ring-4 ring-inset ring-blue-400'
    : '';

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
    <div className={`min-h-screen bg-gray-50 flex flex-col ${ringClass}`}>
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
