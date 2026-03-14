import { Modal } from './ui/Modal';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteUserModal({ isOpen, onClose }: InviteUserModalProps) {
  return (
    <Modal isOpen={isOpen} title="Invite to Collection" onClose={onClose} size="sm">
      <div className="py-4 flex flex-col items-center gap-4 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-600">
            Invite users to your collection so they can browse your vinyl.
          </p>
          <p className="mt-2 text-sm text-gray-400 italic">This feature is coming soon.</p>
        </div>
      </div>
    </Modal>
  );
}
