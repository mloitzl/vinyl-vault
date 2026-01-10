import { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  shadow?: 'sm' | 'md' | 'lg' | 'none';
  border?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

const paddingClasses = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const shadowClasses = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow',
  lg: 'shadow-lg',
};

export function Card({
  children,
  header,
  footer,
  className = '',
  padding = 'md',
  shadow = 'sm',
  border = true,
  interactive = false,
  onClick,
}: CardProps) {
  const baseClasses = 'bg-white rounded-lg transition-all';
  const borderClass = border ? 'border border-gray-200' : '';
  const shadowClass = shadowClasses[shadow];
  const paddingClass = paddingClasses[padding];
  const interactiveClass = interactive
    ? 'cursor-pointer hover:shadow-md hover:border-gray-300'
    : '';

  return (
    <div
      className={`${baseClasses} ${borderClass} ${shadowClass} ${interactiveClass} ${className}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {header && <div className={`${paddingClass} border-b border-gray-100`}>{header}</div>}

      <div className={paddingClass}>{children}</div>

      {footer && <div className={`${paddingClass} border-t border-gray-100`}>{footer}</div>}
    </div>
  );
}
