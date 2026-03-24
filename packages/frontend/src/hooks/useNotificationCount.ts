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
 * Fetches on mount, whenever the browser tab regains focus (visibilitychange),
 * on the `vinyl-vault:notifications-changed` custom event (own actions), and
 * every 30 s so incoming requests from other users appear without a page reload.
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

    const intervalId = setInterval(fetchCount, 30_000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('vinyl-vault:notifications-changed', fetchCount);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('vinyl-vault:notifications-changed', fetchCount);
    };
  }, [fetchCount]);

  return count;
}
