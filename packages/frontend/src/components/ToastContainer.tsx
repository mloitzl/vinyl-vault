import { useToast } from '../contexts';
import { Toast } from './Toast';

/**
 * ToastContainer displays all active toast notifications
 * Should be placed at the root level (e.g., in App.tsx or a layout component)
 */
export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type === 'warning' ? 'info' : toast.type}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
