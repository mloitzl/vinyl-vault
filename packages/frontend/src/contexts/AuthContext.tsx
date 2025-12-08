// Auth context for managing authentication state

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface AvailableTenant {
  id: string;
  name: string;
  type: 'USER' | 'ORGANIZATION';
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface User {
  id: string;
  githubId: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
}

interface AuthContextType {
  user: User | null;
  activeTenant: AvailableTenant | null;
  availableTenants: AvailableTenant[];
  isLoading: boolean;
  error: string | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [activeTenant, setActiveTenant] = useState<AvailableTenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<AvailableTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user from /auth/me
  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/auth/me', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }

      const data = await response.json();
      setUser(data.user || null);

      // Extract tenant info from response
      if (data.user && data.availableTenants) {
        setAvailableTenants(data.availableTenants);
        if (data.activeTenant) {
          setActiveTenant(data.activeTenant);
        } else if (data.availableTenants.length > 0) {
          // Default to first available tenant if no active tenant
          setActiveTenant(data.availableTenants[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
      setUser(null);
      setActiveTenant(null);
      setAvailableTenants([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Redirect to GitHub OAuth login
  const login = useCallback(() => {
    window.location.href = '/auth/github';
  }, []);

  // Logout and clear session
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to logout');
      }

      setUser(null);
      setActiveTenant(null);
      setAvailableTenants([]);
    } catch (err) {
      console.error('Error logging out:', err);
      setError(err instanceof Error ? err.message : 'Failed to logout');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Switch active tenant via GraphQL mutation
  const switchTenant = useCallback(async (tenantId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const query = `mutation SwitchTenant($tenantId: String!) {
        switchTenant(tenantId: $tenantId) {
          id
          githubLogin
          displayName
          avatarUrl
          role
          availableTenants {
            id
            name
            type
            role
          }
          activeTenant {
            id
            name
            type
            role
          }
        }
      }`;

      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query, variables: { tenantId } }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch tenant');
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'Failed to switch tenant');
      }

      const result = data.data.switchTenant;

      // Update state with new tenant context
      setAvailableTenants(result.availableTenants || []);
      setActiveTenant(result.activeTenant || null);

      console.log('[AuthContext] Switched to tenant:', tenantId);
    } catch (err) {
      console.error('Error switching tenant:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch tenant');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check for auth errors in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('error');

    if (authError) {
      setError(`Authentication failed: ${authError}`);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Fetch user on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const value: AuthContextType = {
    user,
    activeTenant,
    availableTenants,
    isLoading,
    error,
    login,
    logout,
    refreshUser,
    switchTenant,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}
