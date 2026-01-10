import { ReactNode } from 'react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  children: ReactNode;
  type?: AlertType;
  title?: string;
  onDismiss?: () => void;
  icon?: ReactNode;
}

const typeClasses: Record<AlertType, { bg: string; border: string; text: string; icon: string }> = {
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'text-blue-600',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: 'text-green-600',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: 'text-yellow-600',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'text-red-600',
  },
};

export function Alert({ children, type = 'info', title, onDismiss, icon }: AlertProps) {
  const classes = typeClasses[type];

  return (
    <div className={`${classes.bg} ${classes.border} border rounded-lg p-4`}>
      <div className="flex gap-3">
        {icon && <div className={`${classes.icon} flex-shrink-0 flex items-center`}>{icon}</div>}

        <div className="flex-1">
          {title && <h3 className={`${classes.text} font-medium`}>{title}</h3>}
          <div className={`${classes.text} text-sm ${title ? 'mt-1' : ''}`}>{children}</div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`${classes.text} flex-shrink-0 hover:opacity-75 transition-opacity`}
            aria-label="Dismiss alert"
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
        )}
      </div>
    </div>
  );
}
