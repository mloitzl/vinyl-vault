import { useAuth } from '../contexts/AuthContext';
import { UserDropdownMenu } from './UserDropdownMenu';
import { Button } from './ui/Button';
import { executeGraphQLMutation } from '../utils/graphqlExecutor.js';

export function Header() {
  const { user, isLoading, login, activeTenant, availableTenants, refreshUser } = useAuth();

  const isForeignTenant = !!(user && activeTenant && activeTenant.id !== `user_${user.id}`);
  const isFriendCollection = isForeignTenant && activeTenant?.type === 'USER' && activeTenant?.role === 'VIEWER';
  const isOrgContext = isForeignTenant && !isFriendCollection;
  const isViewer = activeTenant?.role === 'VIEWER';

  const handleBackToOwn = async () => {
    if (!user) return;
    const ownTenantId = `user_${user.id}`;
    const ownTenant = availableTenants.find((t) => t.id === ownTenantId);
    if (!ownTenant) return;
    try {
      await executeGraphQLMutation(
        `mutation HeaderSwitchTenant($tenantId: String!) { switchTenant(tenantId: $tenantId) { id } }`,
        { tenantId: ownTenantId }
      );
      await refreshUser();
    } catch {
      // Ignore errors silently
    }
  };

  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <span className="text-2xl mr-2">💿</span>
            <h1 className="text-xl font-bold text-gray-900">Vinyl Vault</h1>
          </div>

          {/* Auth section */}
          <div className="flex items-center">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
              </div>
            ) : user ? (
              <UserDropdownMenu />
            ) : (
              <LoginButton onClick={login} />
            )}
          </div>
        </div>
      </div>

      {/* Friend-collection context banner (slate blue) */}
      {isFriendCollection && activeTenant && (
        <div className="px-4 py-1.5 text-sm font-medium flex items-center gap-2 bg-slate-50 border-t border-slate-200 text-slate-800">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>
            Browsing <strong>{activeTenant.name}</strong>'s collection
          </span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide bg-slate-200 text-slate-900">
            FRIEND
          </span>
          <button
            onClick={handleBackToOwn}
            className="ml-auto text-xs font-semibold text-slate-700 hover:text-slate-900 underline"
          >
            Back
          </button>
        </div>
      )}

      {/* Org / member context banner (unchanged) */}
      {isOrgContext && activeTenant && (
        <div
          className={`px-4 py-1.5 text-sm font-medium flex items-center gap-2 ${
            isViewer
              ? 'bg-amber-50 border-t border-amber-200 text-amber-800'
              : 'bg-blue-50 border-t border-blue-200 text-blue-800'
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>
            Browsing <strong>{activeTenant.name}</strong>&apos;s collection
          </span>
          <span
            className={`ml-1 px-1.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${
              isViewer
                ? 'bg-amber-200 text-amber-900'
                : 'bg-blue-200 text-blue-900'
            }`}
          >
            {activeTenant.role}
          </span>
        </div>
      )}
    </header>
  );
}

interface LoginButtonProps {
  onClick: () => void;
}

function LoginButton({ onClick }: LoginButtonProps) {
  return (
    <Button variant="primary" onClick={onClick} className="flex items-center gap-2">
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          clipRule="evenodd"
        />
      </svg>
      Sign in with GitHub
    </Button>
  );
}
