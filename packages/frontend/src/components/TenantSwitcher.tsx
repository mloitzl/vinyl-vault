import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRoleColors, getRoleLabel } from '../constants/roles';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';

export function TenantSwitcher() {
  const { activeTenant, availableTenants, switchTenant } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwitch = async (tenantId: string) => {
    if (tenantId === activeTenant?.id) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await switchTenant(tenantId);
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to switch tenant:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch tenant');
    } finally {
      setIsLoading(false);
    }
  };

  console.log(
    'Rendering TenantSwitcher with activeTenant:',
    activeTenant,
    'availableTenants:',
    availableTenants
  );
  // Don't show if only one tenant or no active tenant
  if (!activeTenant || availableTenants.length <= 1) {
    return null;
  }

  return (
    <div className="tenant-switcher relative">
      <Button
        variant="secondary"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
        title="Switch tenant"
      >
        <span className="text-sm font-medium">{activeTenant.name}</span>
        <span className="text-xs opacity-70">({activeTenant.type})</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </Button>

      {isOpen && (
        <div className="tenant-menu absolute top-full mt-2 left-0 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          {error && (
            <div className="px-4 py-2 border-b border-red-200 bg-red-50">
              <Alert type="error" onDismiss={() => setError(null)}>
                {error}
              </Alert>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {availableTenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => handleSwitch(tenant.id)}
                disabled={isLoading || tenant.id === activeTenant.id}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                  tenant.id === activeTenant.id
                    ? 'bg-emerald-50 cursor-default'
                    : isLoading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">{tenant.name}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-800">
                        {tenant.type}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getRoleColors(tenant.role)}`}>
                        {getRoleLabel(tenant.role)}
                      </span>
                    </div>
                  </div>
                  {tenant.id === activeTenant.id && (
                    <svg
                      className="w-4 h-4 text-emerald-600 flex-shrink-0"
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
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
    </div>
  );
}
