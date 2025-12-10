// Organization Installation Success Notification Component
// Displays when a new organization has been successfully installed

import { useEffect, useState } from 'react';

interface OrgInstalledNotificationProps {
  orgName: string;
  onDismiss: () => void;
  autoCloseDuration?: number; // milliseconds, default 5000
}

/**
 * OrgInstalledNotification Component
 *
 * Shows a success message when:
 * 1. User completes GitHub App installation
 * 2. Backend creates organization tenant
 * 3. URL contains ?org_installed=<name> query parameter
 *
 * Features:
 * - Auto-dismisses after 5 seconds
 * - Manual close button
 * - Smooth fade-in and fade-out animations
 * - Accessible with role and ARIA labels
 * - Dark mode support
 *
 * Integration: Called from App.tsx when detecting org_installed query param
 */
export function OrgInstalledNotification({
  orgName,
  onDismiss,
  autoCloseDuration = 5000,
}: OrgInstalledNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!isVisible) {
      onDismiss();
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, autoCloseDuration);

    return () => clearTimeout(timer);
  }, [isVisible, autoCloseDuration, onDismiss]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-right-full duration-300"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="bg-white rounded-lg shadow-lg border-l-4 border-green-500 overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          {/* Success Icon */}
          <div className="flex-shrink-0 w-5 h-5 text-green-500 flex items-center justify-center mt-0.5">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Organization Added</h3>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-medium">{orgName}</span> has been successfully added to your
              collection. You can now switch to it using the tenant switcher.
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss notification"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
