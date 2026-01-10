// Organization Installation Success Notification Component
// Displays when a new organization has been successfully installed
// Now uses the Toast component for consistency

import { Toast } from './Toast';

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
 * Now delegates to Toast component for consistent notifications.
 * Auto-dismisses after 5 seconds.
 *
 * Integration: Called from App.tsx when detecting org_installed query param
 */
export function OrgInstalledNotification({
  orgName,
  onDismiss,
  autoCloseDuration = 5000,
}: OrgInstalledNotificationProps) {
  return (
    <Toast
      type="success"
      title="Organization Added"
      message={`${orgName} has been successfully added to your collection. You can now switch to it using the tenant switcher.`}
      duration={autoCloseDuration}
      onDismiss={onDismiss}
      autoClose={true}
    />
  );
}
