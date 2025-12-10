// Header component with user profile and auth actions

import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel, getRoleColors } from '../constants/roles';
import { TenantSwitcher } from './TenantSwitcher';
import { AddOrgButton } from './AddOrgButton';

export function Header() {
  const { user, isLoading, login, logout } = useAuth();

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
              <div className="animate-pulse flex items-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              </div>
            ) : user ? (
              <UserMenu user={user} onLogout={logout} />
            ) : (
              <LoginButton onClick={login} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// Login button component
interface LoginButtonProps {
  onClick: () => void;
}

function LoginButton({ onClick }: LoginButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
    >
      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          clipRule="evenodd"
        />
      </svg>
      Sign in with GitHub
    </button>
  );
}

// User menu component with profile and logout
interface UserMenuProps {
  user: {
    displayName: string;
    avatarUrl?: string;
    githubLogin: string;
    role: string;
  };
  onLogout: () => Promise<void>;
}

function UserMenu({ user, onLogout }: UserMenuProps) {
  return (
    <div className="flex items-center space-x-4">
      {/* Add Organization button */}
      <AddOrgButton />

      {/* Tenant switcher */}
      <TenantSwitcher />

      {/* User info */}
      <div className="flex items-center space-x-3">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-8 h-8 rounded-full ring-2 ring-gray-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <span className="text-gray-600 text-sm font-medium">
              {user.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-gray-900">{user.displayName}</p>
          <p className="text-xs text-gray-500">@{user.githubLogin}</p>
        </div>
        {/* Role badge */}
        <span
          className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColors(
            user.role
          )}`}
        >
          {getRoleLabel(user.role)}
        </span>
      </div>

      {/* Logout button */}
      <button
        onClick={onLogout}
        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
