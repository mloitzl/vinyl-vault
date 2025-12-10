// Toast Notification Component
// Displays temporary success, error, or info messages

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number; // milliseconds, default 3000
  onDismiss?: () => void;
}

/**
 * Toast Component
 *
 * Displays a temporary notification that auto-dismisses.
 * Used for success/error feedback on user actions.
 *
 * Features:
 * - Auto-dismisses after configurable duration
 * - Manual close button
 * - Smooth animations
 * - Type variants (success, error, info)
 * - Accessible with ARIA labels
 */
export function Toast({ message, type = 'success', duration = 3000, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!isVisible) {
      onDismiss?.();
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [isVisible, duration, onDismiss]);

  if (!isVisible) {
    return null;
  }

  const colors = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      icon: 'text-green-500',
      text: 'text-gray-900',
      subtext: 'text-gray-600',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      icon: 'text-red-500',
      text: 'text-gray-900',
      subtext: 'text-gray-600',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      icon: 'text-blue-500',
      text: 'text-gray-900',
      subtext: 'text-gray-600',
    },
  };

  const color = colors[type];

  const icons = {
    success: (
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
      </svg>
    ),
    error: (
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
      </svg>
    ),
    info: (
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    ),
  };

  return (
    <div
      className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-right-full duration-300"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`${color.bg} rounded-lg shadow-lg border-l-4 ${color.border} overflow-hidden`}
      >
        <div className="p-4 flex items-start gap-3">
          {/* Icon */}
          <div
            className={`flex-shrink-0 w-5 h-5 ${color.icon} flex items-center justify-center mt-0.5`}
          >
            {icons[type]}
          </div>

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${color.text}`}>{message}</p>
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
