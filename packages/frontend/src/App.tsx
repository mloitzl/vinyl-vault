import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RelayEnvironmentProvider } from 'react-relay';
import { RelayEnvironment } from './relay/environment';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import {
  Header,
  LoadingSpinner,
  OrgInstalledNotification,
  DesktopNavigation,
  MobileNavigation,
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

function AppContent() {
  const { user, isLoading, error, refreshUser, activeTenant } = useAuth();
  const [orgInstalled, setOrgInstalled] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const [artistCount, setArtistCount] = useState(0);

  // Fetch record statistics
  const fetchStats = async () => {
    try {
      const query = `query FetchRecords($first: Int) {
        records(first: $first) {
          edges {
            node {
              id
              release {
                artist
              }
            }
          }
          totalCount
        }
      }`;

      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query, variables: { first: 1000 } }),
      });

      const body = await res.json();
      const data = body.data?.records;

      if (data) {
        setRecordCount(data.totalCount);
        // Count unique artists
        const artists = new Set(
          data.edges.map((edge: any) => edge.node.release?.artist).filter((artist: any) => artist)
        );
        setArtistCount(artists.size);
      }
    } catch (err) {
      console.warn('Failed to fetch stats:', err);
    }
  };

  // Fetch stats when user changes, tenant changes, or when adding records
  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, activeTenant]);

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
      ) : (
        <div className="flex-1 flex">
          {/* Desktop Sidebar Navigation - visible on md and up */}
          {user && <DesktopNavigation recordCount={recordCount} artistCount={artistCount} />}

          {/* Main content area */}
          <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto md:mx-0 md:max-w-none">
            <Routes>
              <Route
                path="/"
                element={<HomePage recordCount={recordCount} artistCount={artistCount} />}
              />
              <Route path="/scan" element={<ScanPage onRecordAdded={fetchStats} />} />
              <Route path="/collection" element={<CollectionPage />} />
              <Route path="/collection/:recordId" element={<RecordDetailPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      )}

      {/* Bottom Navigation - Mobile only, authenticated users */}
      {user && <MobileNavigation />}
    </div>
  );
}

function App() {
  return (
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </RelayEnvironmentProvider>
  );
}

export default App;
