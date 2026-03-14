import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';

interface PersonalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PersonalSettingsModal({ isOpen, onClose }: PersonalSettingsModalProps) {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Modal isOpen={isOpen} title="Personal Settings" onClose={onClose} size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-16 h-16 rounded-full ring-2 ring-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-600 text-xl font-medium">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{user.displayName}</p>
            <p className="text-sm text-gray-500">@{user.githubLogin}</p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-400 italic">More settings coming soon.</p>
        </div>
      </div>
    </Modal>
  );
}
