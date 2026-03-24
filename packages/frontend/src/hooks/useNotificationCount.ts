import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { executeGraphQLMutation } from '../utils/graphqlExecutor.js';

const NOTIFICATION_COUNT_QUERY = `
  query useNotificationCount {
    notificationCount
  }
`;

/**
 * Returns the total notification count for the current user, aggregated
 * across all notification types (pending friend requests, and any future types
 * added to the backend `notificationCount` resolver).
 *
 * Fetches on mount and re-fetches whenever the browser tab regains focus
 * (visibilitychange), keeping the badge current without polling or WebSockets.
 */
export function useNotificationCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const data = await executeGraphQLMutation(NOTIFICATION_COUNT_QUERY, {});
      setCount(data?.notificationCount ?? 0);
    } catch {
      // Silently ignore — badge is best-effort
    }
  }, [user]);

  useEffect(() => {
    fetchCount();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchCount]);

  return count;
}
