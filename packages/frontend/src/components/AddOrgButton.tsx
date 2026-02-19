// Add Organization Button Component
// Allows users to explicitly install Vinyl Vault on GitHub organizations they manage
// Adheres to Architecture.MD section 5.1.1 - Dual Authentication Pattern (Mode 2)

import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { getEndpoint } from '../utils/apiUrl.js';

interface AddOrgButtonProps {
  className?: string;
}

/**
 * AddOrgButton Component
 *
 * This button directs authenticated users to GitHub's App installation flow.
 * - User clicks button
 * - Gets redirected to GitHub App installation page
 * - GitHub displays only organizations where user has installation authority
 * - User selects org and clicks "Install"
 * - GitHub sends webhook + redirects back to /setup endpoint
 * - New organization tenant is created and added to user's available tenants
 *
 * Security: No sensitive data is passed through the URL. All validation happens
 * server-side with authenticated session cookie.
 */
export function AddOrgButton({ className = '' }: AddOrgButtonProps) {
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the GitHub App installation URL from the BFF /auth/me endpoint
  useEffect(() => {
    const fetchInstallUrl = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch from BFF /auth/me REST endpoint (much simpler than GraphQL)
        const response = await fetch(getEndpoint('/auth/me'), {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch from /auth/me: ${response.status}`);
        }

        const data = await response.json();
        const url = data.githubAppInstallationUrl;

        if (url) {
          setInstallUrl(url);
        } else {
          console.warn('No githubAppInstallationUrl in /auth/me response, using default');
          // Fallback to default URL
          setInstallUrl('https://github.com/apps/vinyl-vault/installations/new');
        }
      } catch (err) {
        console.error('Error fetching installation URL:', err);
        setError(err instanceof Error ? err.message : 'Failed to load GitHub App settings');
        // Fallback to default URL on error
        setInstallUrl('https://github.com/apps/vinyl-vault/installations/new');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstallUrl();
  }, []);

  if (isLoading) {
    return (
      <Button variant="primary" disabled className={`${className}`}>
        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Loading...
      </Button>
    );
  }

  if (error && !installUrl) {
    return (
      <Button variant="danger" disabled title={error} className={`${className}`}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
        Error
      </Button>
    );
  }

  return (
    <a
      href={installUrl || '#'}
      target="_self"
      rel="noopener noreferrer"
      className="no-underline"
      title="Install Vinyl Vault on a GitHub organization you manage"
    >
      <Button variant="primary" className="flex items-center gap-2">
        {/* GitHub Icon */}
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.868-.013-1.703-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.547 2.914 1.186.092-.923.35-1.546.636-1.903-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
        Add Organization
      </Button>
    </a>
  );
}
