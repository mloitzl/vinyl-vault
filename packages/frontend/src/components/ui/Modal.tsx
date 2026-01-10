import { ReactNode } from 'react';

export interface ModalProps {
  isOpen: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdropClick?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export function Modal({
  isOpen,
  title,
  children,
  footer,
  onClose,
  size = 'md',
  closeOnBackdropClick = true,
}: ModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleEscape}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div className={`${sizeClasses[size]} w-full mx-4 bg-white rounded-lg shadow-lg`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="px-6 py-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
