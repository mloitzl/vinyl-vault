import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleColors, getRoleLabel } from '../constants/roles';
import { getEndpoint } from '../utils/apiUrl.js';
import { PersonalSettingsModal } from './settings/PersonalSettingsModal';
import { TenantSettingsModal } from './settings/TenantSettingsModal';
import { InviteUserModal } from './InviteUserModal';

export function UserDropdownMenu() {
  const { user, activeTenant, availableTenants, logout, switchTenant, featureFlags } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [showPersonalSettings, setShowPersonalSettings] = useState(false);
  const [showTenantSettings, setShowTenantSettings] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Lazily fetch the GitHub App installation URL when the dropdown is first opened
  useEffect(() => {
    if (!isOpen || !featureFlags.enableTenantFeatures || installUrl !== null) return;
    fetch(getEndpoint('/auth/me'), { credentials: 'include' })
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Failed to fetch auth info: ${r.status}`);
        }
        return r.json();
      })
      .then((data) =>
        setInstallUrl(
          data.githubAppInstallationUrl || 'https://github.com/apps/vinyl-vault/installations/new'
        )
      )
      .catch(() =>
        setInstallUrl('https://github.com/apps/vinyl-vault/installations/new')
      );
  }, [isOpen, featureFlags.enableTenantFeatures, installUrl]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === activeTenant?.id || isSwitching) return;
    setIsSwitching(true);
    setSwitchError(null);
    try {
      await switchTenant(tenantId);
      setIsOpen(false);
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Failed to switch tenant');
    } finally {
      setIsSwitching(false);
    }
  };

  // Close dropdown then open a modal
  const openModal = (show: () => void) => {
    setIsOpen(false);
    show();
  };

  if (!user) return null;

  const tenantRole = activeTenant?.role ?? 'VIEWER';
  const isAdmin = tenantRole === 'ADMIN';
  const showTenantSection = featureFlags.enableTenantFeatures;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Avatar chip — the only thing visible in the header */}
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full p-1 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
          aria-expanded={isOpen}
          aria-haspopup="true"
          title={user.displayName}
        >
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
          <svg
            className={`hidden sm:block w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown panel */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
            {/* ── Section 1: User identity ── */}
            <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full ring-2 ring-gray-200 flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-600 font-medium">
                    {user.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.displayName}</p>
                <p className="text-xs text-gray-500 truncate">@{user.githubLogin}</p>
                {activeTenant && (
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-xs text-gray-500 truncate">{activeTenant.name}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${getRoleColors(tenantRole)}`}
                    >
                      {getRoleLabel(tenantRole)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 2: Tenant switcher + Add Org ── */}
            {showTenantSection && (
              <div className="py-1 border-b border-gray-100">
                {switchError && (
                  <p className="px-4 py-1.5 text-xs text-red-600 bg-red-50">{switchError}</p>
                )}
                <div className="max-h-48 overflow-y-auto">
                  {availableTenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => handleSwitch(tenant.id)}
                      disabled={isSwitching || tenant.id === activeTenant?.id}
                      className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                        tenant.id === activeTenant?.id
                          ? 'bg-emerald-50 cursor-default'
                          : isSwitching
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <span className="w-4 flex-shrink-0">
                        {tenant.id === activeTenant?.id && (
                          <svg
                            className="w-4 h-4 text-emerald-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 block truncate">
                          {tenant.name}
                        </span>
                        <div className="flex gap-1.5 mt-0.5">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {tenant.type}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${getRoleColors(tenant.role)}`}
                          >
                            {getRoleLabel(tenant.role)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Add Organization — subtle text link */}
                {installUrl && (
                  <a
                    href={installUrl}
                    className="w-full text-left px-4 py-2 flex items-center gap-3 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    <span className="w-4 flex-shrink-0">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </span>
                    Add Organization
                  </a>
                )}
              </div>
            )}

            {/* ── Section 3: Invite (coming soon) ── */}
            <div className="py-1 border-b border-gray-100">
              <button
                onClick={() => openModal(() => setShowInvite(true))}
                className="w-full text-left px-4 py-2 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                title="Coming soon"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
                Invite to Collection
                <span className="ml-auto text-xs text-gray-400">soon</span>
              </button>
            </div>

            {/* ── Section 4: Settings ── */}
            <div className="py-1 border-b border-gray-100">
              <button
                onClick={() => openModal(() => setShowPersonalSettings(true))}
                className="w-full text-left px-4 py-2 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-4 h-4 text-gray-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Personal Settings
              </button>

              {isAdmin && (
                <button
                  onClick={() => openModal(() => setShowTenantSettings(true))}
                  className="w-full text-left px-4 py-2 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg
                    className="w-4 h-4 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  Tenant Settings
                </button>
              )}
            </div>

            {/* ── Section 5: Sign out ── */}
            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2 flex items-center gap-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg
                  className="w-4 h-4 text-gray-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PersonalSettingsModal
        isOpen={showPersonalSettings}
        onClose={() => setShowPersonalSettings(false)}
      />
      <TenantSettingsModal
        isOpen={showTenantSettings}
        onClose={() => setShowTenantSettings(false)}
      />
      <InviteUserModal isOpen={showInvite} onClose={() => setShowInvite(false)} />
    </>
  );
}
